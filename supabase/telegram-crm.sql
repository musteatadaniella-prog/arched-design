-- Step 7 (CRM in Telegram). Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. Lets staff change a client's stage from the Telegram
-- Mini App, with their Telegram name recorded in the stage history.

-- 1. The history trigger takes the author from the admin's email (site) or,
-- when the server sets it, from app.actor (Telegram).
create or replace function public.log_lead_stage() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := coalesce(auth.jwt() ->> 'email', nullif(current_setting('app.actor', true), ''));
begin
  if tg_op = 'INSERT' then
    insert into public.lead_stage_history (lead_id, from_status, to_status, changed_at, changed_by)
    values (new.id, null, new.status, new.created_at, actor);
  elsif new.status is distinct from old.status then
    insert into public.lead_stage_history (lead_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, actor);
  end if;
  return new;
end $$;

-- 2. Stage change with a named author, in one transaction. Only the server
-- (secret key) may call it; it checks the staff list before calling.
create or replace function public.set_lead_stage(p_id uuid, p_status text, p_actor text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', p_actor, true);
  update public.leads set status = p_status where id = p_id;
  return found;
end $$;

revoke execute on function public.set_lead_stage(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_lead_stage(uuid, text, text) to service_role;
