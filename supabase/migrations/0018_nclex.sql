-- ============================================================
-- MyLifePlanner — NCLEX Tracker (Premium)
-- Track NCLEX practice-question performance and turn it into a readiness
-- picture: per-category accuracy, question-bank volume, and a heuristic
-- predicted-pass estimate.
--
--   • profiles.nclex_exam_date     — the scheduled licensure-exam date (a
--     countdown; one per user → a profile column, like vision_statement).
--   • profiles.nclex_question_goal — how many practice questions you're aiming
--     to complete before the exam (drives the question-bank progress bar).
--   • nclex_sessions               — one row per logged practice block, attributed
--     to a single NCLEX "Client Needs" category, with attempted + correct counts.
--
-- TERM-AGNOSTIC by design (like Long Term Vision, 0017): NCLEX readiness is a
-- CUMULATIVE journey toward one licensure exam, so every question you've ever
-- practised keeps counting — it never archives per academic term and carries a
-- no `term` stamp. The page aggregates the full history client-side (small,
-- personal row counts), so no roll-up RPC is needed.
--
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- Exam plan (singletons — profile columns) ----------
alter table public.profiles
  add column if not exists nclex_exam_date date;
alter table public.profiles
  add column if not exists nclex_question_goal int;

-- ---------- NCLEX practice sessions ----------
create table if not exists public.nclex_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  session_date  date not null default current_date,
  -- One of the eight NCLEX-RN "Client Needs" categories (see the page's CATEGORIES).
  category      text not null
                  check (category in (
                    'management_of_care', 'safety_infection', 'health_promotion',
                    'psychosocial', 'basic_care', 'pharmacology',
                    'risk_reduction', 'physiological')),
  source        text,                              -- question bank (UWorld, Kaplan, ATI…) — free text
  total         int  not null check (total > 0),   -- questions attempted in the block
  correct       int  not null check (correct >= 0 and correct <= total),
  note          text,
  created_at    timestamptz default now()
);
-- The page fetches a user's full history, newest first, to aggregate readiness.
create index if not exists nclex_sessions_user_idx
  on public.nclex_sessions (user_id, session_date desc);

alter table public.nclex_sessions enable row level security;
drop policy if exists "nclex_sessions_own" on public.nclex_sessions;
create policy "nclex_sessions_own" on public.nclex_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
