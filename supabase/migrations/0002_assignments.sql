-- ============================================================
-- MyLifePlanner — Assignments (Stop 1)
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  course      text,
  due_date    date,
  due_time    text,
  priority    text not null default 'medium',   -- high | medium | low
  status      text not null default 'pending',  -- pending | in_progress | completed
  type        text,
  description text,
  created_at  timestamptz default now()
);

create index if not exists assignments_user_idx on public.assignments (user_id);

alter table public.assignments enable row level security;

drop policy if exists "assignments_own" on public.assignments;
create policy "assignments_own" on public.assignments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
