-- Step 6 (invoices). Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. Invoices are built from the client card: by the
-- "Emite factura" button or automatically when the card moves to
-- "Ofertă trimisă". The PDF itself is drawn and sent by the server.

-- 1. Numbers: AD-2026-0001, AD-2026-0002, … One counter row per year, bumped
-- inside the same transaction as the invoice, so numbers never repeat and a
-- failed insert does not leave a gap.
create table if not exists public.invoice_counters (
  year int primary key,
  last int not null
);

create or replace function public.next_invoice_number() returns text
language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from (now() at time zone 'Europe/Chisinau'))::int;
  n int;
begin
  insert into public.invoice_counters (year, last) values (y, 1)
  on conflict (year) do update set last = public.invoice_counters.last + 1
  returning last into n;
  return 'AD-' || y || '-' || lpad(n::text, 4, '0');
end $$;

-- 2. Invoices and their lines.
create table if not exists public.invoices (
  id          bigint generated always as identity primary key,
  number      text not null unique,
  lead_id     uuid not null references public.leads (id) on delete cascade,
  issued_on   date not null default (now() at time zone 'Europe/Chisinau')::date,
  due_on      date not null,
  currency    text not null check (currency in ('EUR', 'MDL', 'USD')),
  total       numeric(12, 2) not null check (total >= 0),
  status      text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at     timestamptz,
  -- Stage that issued it automatically; null for invoices made by the button.
  -- One automatic invoice per card and stage: moving the card to the same
  -- stage again does not create a second one.
  auto_stage  text,
  pdf_path    text,
  sent_at     timestamptz,
  sent_via    text,
  send_error  text,
  created_at  timestamptz not null default now(),
  created_by  text,
  constraint invoices_one_auto_per_stage unique (lead_id, auto_stage)
);

create index if not exists invoices_lead_idx on public.invoices (lead_id, created_at);

create table if not exists public.invoice_items (
  id          bigint generated always as identity primary key,
  invoice_id  bigint not null references public.invoices (id) on delete cascade,
  position    int not null,
  title       text not null check (char_length(title) between 1 and 200),
  qty         numeric(12, 2) not null check (qty > 0),
  unit_price  numeric(12, 2) not null check (unit_price >= 0),
  amount      numeric(12, 2) generated always as (round(qty * unit_price, 2)) stored
);

create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

-- 3. Creating an invoice: number, lines and total in one transaction.
-- p_items: [{"title": "...", "qty": 1, "price": 1000}, ...]
-- Returns the new id, or null when this card already has an automatic
-- invoice for p_auto_stage.
create or replace function public.create_invoice(
  p_lead uuid, p_items jsonb, p_due_days int default 7, p_auto_stage text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_currency text;
  v_id bigint;
  v_total numeric(12, 2);
  v_item jsonb;
  v_pos int := 0;
begin
  if p_auto_stage is not null and exists (
    select 1 from public.invoices where lead_id = p_lead and auto_stage = p_auto_stage
  ) then
    return null;
  end if;

  select contract_currency into v_currency from public.leads where id = p_lead;
  if not found then raise exception 'lead not found'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'invoice needs 1 to 20 lines';
  end if;
  if p_due_days not between 0 and 365 then raise exception 'bad due days'; end if;

  select coalesce(sum(round((i ->> 'qty')::numeric * (i ->> 'price')::numeric, 2)), 0)
    into v_total from jsonb_array_elements(p_items) i;

  insert into public.invoices (number, lead_id, due_on, currency, total, auto_stage, created_by)
  values (
    public.next_invoice_number(), p_lead,
    (now() at time zone 'Europe/Chisinau')::date + p_due_days,
    coalesce(v_currency, 'EUR'), v_total, p_auto_stage,
    coalesce(auth.jwt() ->> 'email', nullif(current_setting('app.actor', true), ''), 'Automat')
  )
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    insert into public.invoice_items (invoice_id, position, title, qty, unit_price)
    values (v_id, v_pos, trim(v_item ->> 'title'), (v_item ->> 'qty')::numeric, (v_item ->> 'price')::numeric);
  end loop;

  return v_id;
exception
  -- Two simultaneous moves to the same stage: the unique constraint keeps one.
  when unique_violation then
    if p_auto_stage is not null then return null; end if;
    raise;
end $$;

-- 4. Automatic invoice when a card moves to "Ofertă trimisă". It runs in the
-- database, so the admin board, the Telegram Mini App and MCP all trigger it.
-- It bills what is left to pay on the contract; without a contract amount (or
-- with nothing left to pay) no invoice is made.
create or replace function public.auto_invoice_on_stage() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rest numeric(12, 2);
begin
  if new.status = 'proposal' and new.status is distinct from old.status and new.contract_amount is not null then
    select new.contract_amount - coalesce(sum(amount), 0) into v_rest
      from public.lead_payments where lead_id = new.id;
    if v_rest > 0 then
      perform public.create_invoice(
        new.id,
        jsonb_build_array(jsonb_build_object(
          'title', 'Servicii de proiectare' || coalesce(' — ' || nullif(trim(new.project_type), ''), ''),
          'qty', 1,
          'price', v_rest
        )),
        7,
        'proposal'
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists leads_auto_invoice on public.leads;
create trigger leads_auto_invoice
  after update of status on public.leads
  for each row execute function public.auto_invoice_on_stage();

-- 5. Marking an invoice paid: records the payment on the card and moves the
-- card to "Achitat". The stage history shows who did it.
create or replace function public.mark_invoice_paid(p_id bigint, p_actor text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  inv public.invoices;
begin
  if p_actor is not null then perform set_config('app.actor', p_actor, true); end if;

  select * into inv from public.invoices where id = p_id for update;
  if not found then return false; end if;
  if inv.status = 'paid' then return true; end if;

  update public.invoices set status = 'paid', paid_at = now() where id = p_id;

  insert into public.lead_payments (lead_id, amount, paid_on, note, created_by)
  select inv.lead_id, inv.total, (now() at time zone 'Europe/Chisinau')::date, 'Factura ' || inv.number,
         coalesce(auth.jwt() ->> 'email', nullif(current_setting('app.actor', true), ''))
  where inv.total > 0;

  update public.leads set status = 'paid' where id = inv.lead_id and status <> 'paid';
  return true;
end $$;

-- 6. Access. Signed-in admins read invoices and go through the functions
-- above to create them or mark them paid. The PDF path and delivery fields
-- are written only by the server (secret key). Visitors get nothing.
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_counters enable row level security;

drop policy if exists "admins read invoices" on public.invoices;
create policy "admins read invoices" on public.invoices for select to authenticated using (true);
drop policy if exists "admins read invoice items" on public.invoice_items;
create policy "admins read invoice items" on public.invoice_items for select to authenticated using (true);

revoke all on public.invoices, public.invoice_items, public.invoice_counters from anon, authenticated;
grant select on public.invoices, public.invoice_items to authenticated;

revoke execute on function public.next_invoice_number() from public, anon, authenticated;
revoke execute on function public.create_invoice(uuid, jsonb, int, text) from public, anon;
revoke execute on function public.mark_invoice_paid(bigint, text) from public, anon;
grant execute on function public.create_invoice(uuid, jsonb, int, text) to authenticated, service_role;
grant execute on function public.mark_invoice_paid(bigint, text) to authenticated, service_role;

-- 7. Private bucket for the PDFs. No storage policies: only the server reads
-- and writes it, and admins open a PDF through a one-minute signed link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;
