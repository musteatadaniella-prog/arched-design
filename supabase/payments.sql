-- Contract amount and advance payments. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to run again.

-- 1. Contract value on the client card.
alter table public.leads add column if not exists contract_amount numeric(12, 2);
alter table public.leads add column if not exists contract_currency text not null default 'EUR';
alter table public.leads drop constraint if exists leads_contract_amount_check;
alter table public.leads add constraint leads_contract_amount_check
  check (contract_amount is null or contract_amount >= 0);
alter table public.leads drop constraint if exists leads_contract_currency_check;
alter table public.leads add constraint leads_contract_currency_check
  check (contract_currency in ('EUR', 'MDL', 'USD'));

grant update (contract_amount, contract_currency) on public.leads to authenticated;

-- 2. Payments received (advances, installments), in the contract currency.
create table if not exists public.lead_payments (
  id          bigint generated always as identity primary key,
  lead_id     uuid not null references public.leads (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  paid_on     date not null,
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  created_by  text default (auth.jwt() ->> 'email')
);

create index if not exists lead_payments_lead_idx on public.lead_payments (lead_id, paid_on);

-- 3. Access: signed-in admins read, add and delete payments. Visitors get nothing.
alter table public.lead_payments enable row level security;

drop policy if exists "admins read payments" on public.lead_payments;
create policy "admins read payments" on public.lead_payments
  for select to authenticated using (true);

drop policy if exists "admins add payments" on public.lead_payments;
create policy "admins add payments" on public.lead_payments
  for insert to authenticated with check (true);

drop policy if exists "admins delete payments" on public.lead_payments;
create policy "admins delete payments" on public.lead_payments
  for delete to authenticated using (true);

-- Payments are never edited in place (delete and re-add instead), and the
-- author column is filled by the database, not by the client.
revoke all on public.lead_payments from anon, authenticated;
grant select, delete on public.lead_payments to authenticated;
grant insert (lead_id, amount, paid_on, note) on public.lead_payments to authenticated;
