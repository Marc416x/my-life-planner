-- ============================================================
-- MyLifePlanner — Assessments (Grades gradebook)
-- Per-assessment grades that roll up into courses.grade_pct.
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.assessments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  name        text not null,
  type        text,                              -- Quiz | Assignment | Mid-Term | Final Exam | Lab
  score       numeric,
  max_score   numeric,
  weight_pct  numeric,                           -- weight of THIS assessment within its course
  created_at  timestamptz default now()
);

create index if not exists assessments_user_idx on public.assessments (user_id);
create index if not exists assessments_course_idx on public.assessments (course_id);

alter table public.assessments enable row level security;

drop policy if exists "assessments_own" on public.assessments;
create policy "assessments_own" on public.assessments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Roll-up: recompute a course's grade from its assessments ----------
-- Weighted average of (score/max*100) by weight_pct; simple average when no
-- weights are set. Leaves grade_pct null when the course has no scored
-- assessments (so a manually-entered course grade is only replaced once real
-- assessments exist, and cleared again if they're all removed).
create or replace function public.recompute_course_grade(p_course uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g numeric;
begin
  select case
           when coalesce(sum(weight_pct), 0) > 0
             then sum((score / max_score) * 100 * weight_pct) / sum(weight_pct)
           else avg((score / max_score) * 100)
         end
    into g
  from public.assessments
  where course_id = p_course
    and score is not null
    and max_score is not null
    and max_score > 0;

  update public.courses
     set grade_pct = round(g, 1)
   where id = p_course;
end;
$$;

create or replace function public.assessments_recompute()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_course_grade(coalesce(new.course_id, old.course_id));
  -- If an assessment was moved between courses, refresh the old course too.
  if tg_op = 'UPDATE' and new.course_id is distinct from old.course_id then
    perform public.recompute_course_grade(old.course_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists assessments_recompute_trg on public.assessments;
create trigger assessments_recompute_trg
  after insert or update or delete on public.assessments
  for each row execute function public.assessments_recompute();
