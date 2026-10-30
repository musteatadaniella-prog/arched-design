-- Step 7 (image generation). Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. History of design visualizations made with GPT Image 2.5,
-- both by admins in /admin/generate and by clients in the Telegram Mini App.

create table if not exists public.image_generations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- Who asked: an admin (Supabase user id) or a client (Telegram user id).
  owner_kind  text not null check (owner_kind in ('admin', 'telegram')),
  owner_id    text not null,
  owner_label text,
  prompt      text not null,
  style       text,
  -- 'pending' while the picture is being drawn; failed attempts are deleted,
  -- so they do not count toward the daily limit.
  status      text not null default 'pending' check (status in ('pending', 'done')),
  model       text,
  source_path text,
  result_path text
);

create index if not exists image_generations_owner_idx
  on public.image_generations (owner_kind, owner_id, created_at desc);

-- Only the server (secret key) reads and writes this table.
alter table public.image_generations enable row level security;
revoke all on public.image_generations from anon, authenticated;

-- Private bucket for source photos and results. No storage policies: the
-- server hands out short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generations', 'generations', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
