-- Step 5 (business card recognition). Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. Requires crm.sql (the 'business_card' source).

-- 1. Where the original photo / PDF of a client's document is stored.
alter table public.leads add column if not exists document_path text;

-- 2. Private bucket for originals. No storage policies are added, so neither
-- visitors nor the publishable key can list or read files; the server uses the
-- secret key and hands out one-minute signed links to signed-in admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
