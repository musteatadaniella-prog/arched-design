-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'new'
                check (status in ('new', 'in_progress', 'closed')),
  kind          text not null check (kind in ('quote', 'meeting')),
  name          text not null,
  phone         text not null,
  email         text,
  project_type  text,
  area          text,
  comment       text,
  meeting_date  date,
  meeting_time  text,
  lang          text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

-- Row Level Security on, with no policies: the public (anon) key can neither
-- read nor write. The site inserts through the server with the secret key,
-- which bypasses RLS and never reaches the browser.
alter table public.leads enable row level security;
