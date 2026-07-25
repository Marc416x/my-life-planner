-- ============================================================
-- MyLifePlanner — Exams (Exams page)
-- Upcoming exams with a countdown, weight, planned study sessions,
-- confidence level and topics. Course-linked, but deliberately NOT rolled
-- up into courses.grade_pct — an exam here is a plan/target, not a recorded
-- grade (those live in `assessments`, see 0004).
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.exams (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  name             text not null,
  exam_date        date,
  weight_pct       numeric,
  planned_sessions int,
  confidence       int,                             -- 1..5
  topics           text,                            -- comma-separated topics to cover
  created_at       timestamptz default now()
);

create index if not exists exams_user_idx on public.exams (user_id);
create index if not exists exams_course_idx on public.exams (course_id);

alter table public.exams enable row level security;

drop policy if exists "exams_own" on public.exams;
create policy "exams_own" on public.exams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
