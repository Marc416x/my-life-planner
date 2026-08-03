-- ============================================================
-- MyLifePlanner — Drug Tracker (Premium)
-- "Two drugs a day keeps the NCLEX failure away." A personal pharmacology deck
-- (name, class, mechanism, indications, side effects, nursing notes, dose) that
-- quizzes you back with SPACED REPETITION so what you learn actually sticks.
--
--   • profiles.drug_daily_goal — how many new drugs you aim to add each day
--     (a singleton setting, like nclex_question_goal; null → the app's default 2).
--   • drugs                    — one row per drug card. Holds both the reference
--     content AND its spaced-repetition state (a simple Leitner box scheme).
--
-- SPACED REPETITION (Leitner): every card lives in a `box` (0 = new, 5 = mastered).
-- Recall it correctly → it climbs a box and its `due_date` is pushed further out
-- (1 → 3 → 7 → 16 → 30 days). Miss it → back to box 0, due again tomorrow. The
-- daily review queue is simply the cards whose `due_date` has arrived. All of the
-- scheduling maths lives on the page (see BOX_DAYS); the DB just stores the state.
--
-- TERM-AGNOSTIC by design (like NCLEX 0018 and Long Term Vision 0017): a drug you
-- learn in Pharmacology Year 1 is knowledge you keep for the NCLEX and the rest of
-- your career, so cards never archive per academic term and carry no `term` stamp.
-- The deck is small and personal, so the page holds the full list client-side and
-- aggregates in memory — no roll-up RPC needed.
--
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- Daily goal (singleton — a profile column) ----------
alter table public.profiles
  add column if not exists drug_daily_goal int;

-- ---------- Drug cards (reference content + spaced-repetition state) ----------
create table if not exists public.drugs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  drug_class     text,                              -- "Beta-blocker", "Loop diuretic" … (free text; drives the library filter)
  moa            text,                              -- mechanism of action
  indications    text,                              -- what it treats
  side_effects   text,
  nursing        text,                              -- nursing considerations / monitoring / teaching
  dose           text,                              -- dosage & route, e.g. "25–100mg PO daily"
  -- Spaced-repetition state (Leitner):
  box            int  not null default 0 check (box >= 0 and box <= 5),  -- 0 = new/learning … 5 = mastered
  due_date       date not null default current_date,                     -- next review; the queue = due_date <= today
  last_reviewed  date,
  review_count   int  not null default 0,           -- times self-graded in review
  correct_count  int  not null default 0,           -- of which recalled correctly
  learned_on     date not null default current_date,-- day the card was added (drives "added today" + the learning streak)
  created_at     timestamptz default now()
);
-- The daily review fetches by due date; the library lists newest-first.
create index if not exists drugs_due_idx on public.drugs (user_id, due_date);
create index if not exists drugs_user_idx on public.drugs (user_id, created_at desc);

alter table public.drugs enable row level security;
drop policy if exists "drugs_own" on public.drugs;
create policy "drugs_own" on public.drugs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
