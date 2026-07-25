-- ============================================================
-- MyLifePlanner — Class Schedule: link blocks to real courses
-- Schedule blocks now pick their subject from the user's Courses (not free
-- text). Add a course_id FK; the app also keeps the `subject` text column
-- populated with the course label for display / legacy rows. Existing rows
-- keep their text subject and a null course_id until edited.
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

alter table public.schedule_blocks
  add column if not exists course_id uuid references public.courses (id) on delete cascade;

create index if not exists schedule_blocks_course_idx on public.schedule_blocks (course_id);
