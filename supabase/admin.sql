-- Step 3 (admin panel). Run once in Supabase: SQL Editor → New query → paste → Run.
-- Signed-in users (the admin accounts you create under Authentication → Users)
-- may read leads and change only their status. Visitors who are not signed in
-- still get nothing.

drop policy if exists "admins read leads" on public.leads;
create policy "admins read leads" on public.leads
  for select to authenticated using (true);

drop policy if exists "admins update lead status" on public.leads;
create policy "admins update lead status" on public.leads
  for update to authenticated using (true) with check (true);

-- Limit what a signed-in user can write to the status column alone.
revoke insert, update, delete on public.leads from anon, authenticated;
grant update (status) on public.leads to authenticated;
