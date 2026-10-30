-- Step 4 (CRM funnel). Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. Adds funnel stages, lead source, notes and a stage history
-- that the database itself records on every insert and stage change.

-- 1. Funnel stages: Nouă → Contactat → Ofertă trimisă → Achitat, plus Refuz.
alter table public.leads drop constraint if exists leads_status_check;
update public.leads set status = 'contacted' where status = 'in_progress';
update public.leads set status = 'paid' where status = 'closed';
alter table public.leads add constraint leads_status_check
  check (status in ('new', 'contacted', 'proposal', 'paid', 'lost'));

-- 2. Where the client came from. Existing rows came from the site form.
alter table public.leads add column if not exists source text not null default 'site';
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('site', 'manual', 'telegram', 'business_card'));

-- 3. Free-form notes kept by the team.
alter table public.leads add column if not exists notes text;

-- Clients added by hand have no form type (quote / meeting).
alter table public.leads alter column kind drop not null;

-- 4. Stage history, written by a trigger so no code path can skip it.
create table if not exists public.lead_stage_history (
  id          bigint generated always as identity primary key,
  lead_id     uuid not null references public.leads (id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_at  timestamptz not null default now(),
  changed_by  text
);

create index if not exists lead_stage_history_lead_idx
  on public.lead_stage_history (lead_id, changed_at);

create or replace function public.log_lead_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_stage_history (lead_id, from_status, to_status, changed_at, changed_by)
    values (new.id, null, new.status, new.created_at, auth.jwt() ->> 'email');
  elsif new.status is distinct from old.status then
    insert into public.lead_stage_history (lead_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.jwt() ->> 'email');
  end if;
  return new;
end $$;

drop trigger if exists leads_stage_history on public.leads;
create trigger leads_stage_history
  after insert or update of status on public.leads
  for each row execute function public.log_lead_stage();

-- Leads created before this step get their first history entry.
insert into public.lead_stage_history (lead_id, from_status, to_status, changed_at)
select l.id, null, l.status, l.created_at
from public.leads l
where not exists (select 1 from public.lead_stage_history h where h.lead_id = l.id);

-- 5. Access. Signed-in admins read the history, edit stage and notes, and add
-- clients by hand (source 'manual' only). Visitors still get nothing.
alter table public.lead_stage_history enable row level security;

drop policy if exists "admins read stage history" on public.lead_stage_history;
create policy "admins read stage history" on public.lead_stage_history
  for select to authenticated using (true);

revoke insert, update, delete on public.lead_stage_history from anon, authenticated;

drop policy if exists "admins add manual clients" on public.leads;
create policy "admins add manual clients" on public.leads
  for insert to authenticated with check (source = 'manual');

grant update (status, notes) on public.leads to authenticated;
grant insert (name, phone, email, project_type, area, comment, notes, source) on public.leads to authenticated;
