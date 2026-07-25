-- ============================================================
-- MyLifePlanner — Clinicals (Clinicals page)
-- Logged clinical sessions: hours, difficulty, supervisor/ward, the goal
-- for the day, prep notes, post-session reflections and key takeaways.
-- The page's stat cards (total hours, sessions, avg length, avg difficulty)
-- are computed client-side from these rows. Not course-linked — clinicals
-- are tracked by supervisor/department, not a gradebook course.
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.clinical_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  session_date  date,
  hours         numeric,
  difficulty    text,                            -- Easy | Medium | Hard | Very Hard
  supervisor    text,
  department    text,
  goal          text,
  prep          text,                            -- things to learn/prepare before
  reflections   text,                            -- reflections after clinical
  takeaways     text,                            -- key takeaways / what to consider
  created_at    timestamptz default now()
);

create index if not exists clinical_sessions_user_idx on public.clinical_sessions (user_id);
create index if not exists clinical_sessions_date_idx on public.clinical_sessions (session_date);

alter table public.clinical_sessions enable row level security;

drop policy if exists "clinical_sessions_own" on public.clinical_sessions;
create policy "clinical_sessions_own" on public.clinical_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
