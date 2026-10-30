-- Step 6 (Telegram Mini App). Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run again. Links requests sent from the Mini App to the Telegram
-- account that sent them, so that client sees only their own requests.

alter table public.leads add column if not exists telegram_user_id bigint;
alter table public.leads add column if not exists telegram_username text;

create index if not exists leads_telegram_user_idx
  on public.leads (telegram_user_id, created_at desc)
  where telegram_user_id is not null;
