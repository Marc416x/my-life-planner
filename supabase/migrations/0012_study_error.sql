-- ============================================================
-- MyLifePlanner — Study Sessions + Error Log
-- Two per-user, RLS-locked tables. Both carry a `term` stamp (e.g. "Year 1") so
-- a student's data can later be archived when they advance a year: the app
-- filters to the current term, and past terms become a read-only history rather
-- than being deleted. Indexes are (user_id, date desc) so the pages can fetch a
-- small recent window per user instead of an ever-growing list.
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- STUDY SESSIONS (focus timer + manual log) ----------
create table if not exists public.study_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  course_id    uuid references public.courses (id) on delete set null,
  topic        text,
  duration_min int  not null,
  focus        int,                             -- 1..5 self-rating
  notes        text,
  session_date date not null default current_date,
  started_at   timestamptz,                     -- set for live-timer sessions
  term         text,                            -- academic year/term stamp
  created_at   timestamptz default now()
);
create index if not exists study_sessions_user_idx on public.study_sessions (user_id, session_date desc);
create index if not exists study_sessions_course_idx on public.study_sessions (course_id);

alter table public.study_sessions enable row level security;
drop policy if exists "study_sessions_own" on public.study_sessions;
create policy "study_sessions_own" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- ERROR LOG (mistake review cards) ----------
create table if not exists public.error_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  course_id    uuid references public.courses (id) on delete set null,
  topic        text,
  prompt       text not null,                   -- the question / what went wrong
  correct      text,                            -- the correct answer / what it should be
  reason       text,                            -- misread | knowledge_gap | careless | timing | other
  source       text,                            -- Quiz | Exam | Clinical | Practice | Lecture | Other
  resolved     boolean not null default false,  -- reviewed & mastered
  notes        text,
  occurred_on  date not null default current_date,
  term         text,
  created_at   timestamptz default now()
);
create index if not exists error_log_user_idx on public.error_log (user_id, occurred_on desc);
create index if not exists error_log_course_idx on public.error_log (course_id);

alter table public.error_log enable row level security;
drop policy if exists "error_log_own" on public.error_log;
create policy "error_log_own" on public.error_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
