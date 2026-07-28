-- 0011_streaks.sql
-- Study streak: one row per day the user did qualifying activity (completed a
-- daily task, or tapped "Mark today as studied" on the Streaks page). The current
-- and longest streak are derived from this set — nothing to keep in sync.
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to re-run.

create table if not exists public.study_days (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null default current_date,
  created_at timestamptz default now(),
  primary key (user_id, day)
);

alter table public.study_days enable row level security;
drop policy if exists "study_days_own" on public.study_days;
create policy "study_days_own" on public.study_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
