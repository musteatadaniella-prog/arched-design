-- Block 4 (voice agent). Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. Requires crm.sql. Adds the 'voice' lead source for requests
-- left by the ElevenLabs voice agent on the site.

alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('site', 'manual', 'telegram', 'business_card', 'voice'));
