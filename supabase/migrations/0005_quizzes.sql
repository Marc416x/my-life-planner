-- ============================================================
-- MyLifePlanner — Quizzes (practice quiz results)
-- Practice/mastery data, deliberately SEPARATE from GPA. These feed the
-- Grades page "Practice Grades — Mastery Score" section, not courses.grade_pct,
-- so there is no course roll-up trigger here.
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  name        text not null,
  topics      text,                              -- comma-separated topics covered
  difficulty  text,                              -- Easy | Medium | Hard
  score       numeric,
  max_score   numeric,
  time_min    int,                               -- minutes spent on the attempt
  taken_on    date,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists quizzes_user_idx on public.quizzes (user_id);
create index if not exists quizzes_course_idx on public.quizzes (course_id);

alter table public.quizzes enable row level security;

drop policy if exists "quizzes_own" on public.quizzes;
create policy "quizzes_own" on public.quizzes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
