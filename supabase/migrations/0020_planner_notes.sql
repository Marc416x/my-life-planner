-- ============================================================
-- MyLifePlanner — Calendar planner notes (the page's OWN writing surfaces)
--
-- Migration 0020 finishes the Calendar. Step 1 made the grids real by AGGREGATING
-- other pages' dated rows (no storage of its own — see src/lib/calendar-events.ts).
-- What remained were the Calendar's own reflective surfaces, which had no home:
-- the yearly objectives, the "things not to repeat" list, daily gratitude, the
-- daily journal and the weekly reflection. All five were dead inputs.
--
-- ONE table drives all five — the generic kind-specialized engine used by
-- Trackers (0016) and Vision (0017). They differ only in scope and cardinality,
-- and both of those collapse into a single normalized `period_date`:
--
--   kind         scope    period_date            cardinality
--   ----------   ------   --------------------   ---------------------------
--   journal      day      that day               ONE row  (unique)
--   reflection   week     that week's Monday     ONE row  (unique)
--   gratitude    day      that day               many rows
--   objective    year     Jan 1 of that year     many rows (`done` = achieved)
--   avoid        year     Jan 1 of that year     many rows
--
-- Normalizing the period into one date column means one index and one code path
-- serves every scope; src/lib/planner-notes.ts owns the day→period mapping so the
-- client can never disagree with what's stored.
--
-- NOT term-stamped, deliberately: these rows are addressed by date, and the
-- Calendar is scoped by its visible date range rather than by the archived-term
-- picker (same call as the aggregation layer + Progress Metrics — see 0015).
--
-- Deliberately NOT reused here:
--   • vision_items (0017) — that table is the 5/10/20-year picture and is
--     term-agnostic by definition; year-scoped objectives that reset each
--     January don't belong in it.
--   • daily_tasks / weekly_goals (0001) — already the right home for the
--     Calendar's task + goal cards, which now write to them instead of to
--     component state. No schema change needed there.
--
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- PLANNER NOTES ----------
create table if not exists public.planner_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null
                check (kind in ('journal', 'reflection', 'gratitude', 'objective', 'avoid')),
  -- Normalized period start: the day itself, the week's Monday, or Jan 1.
  period_date date not null,
  body        text not null default '',
  done        boolean not null default false,   -- objectives: achieved; list kinds: checked off
  sort_order  int  not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Pages fetch one kind for one period, in order — the index matches exactly.
create index if not exists planner_notes_user_idx
  on public.planner_notes (user_id, kind, period_date, sort_order);

-- The singleton kinds hold at most one row per period, so "save" is an upsert
-- rather than an insert-or-update dance. A PARTIAL unique index keeps the list
-- kinds (gratitude / objective / avoid) free to hold many rows per period.
create unique index if not exists planner_notes_singleton_idx
  on public.planner_notes (user_id, kind, period_date)
  where kind in ('journal', 'reflection');

alter table public.planner_notes enable row level security;
drop policy if exists "planner_notes_own" on public.planner_notes;
create policy "planner_notes_own" on public.planner_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep `updated_at` honest so a future "last edited" hint has something to read.
create or replace function public.touch_planner_notes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planner_notes_touch on public.planner_notes;
create trigger planner_notes_touch
  before update on public.planner_notes
  for each row execute function public.touch_planner_notes();


-- ---------- READING LIST: month scoping ----------
-- The Calendar's card is titled "Books to Read This Month" but reading_list had
-- no date column, so it fetched every monthly book ever added and the "N books"
-- counter grew forever. Add the month the row belongs to (normalized to the 1st).
alter table public.reading_list
  add column if not exists period_date date;

-- Backfill: existing rows belong to the month they were created in, which is the
-- month they were actually added under.
update public.reading_list
   set period_date = date_trunc('month', created_at)::date
 where period_date is null;

create index if not exists reading_list_period_idx
  on public.reading_list (user_id, kind, period_date);

-- NOTE: kind='academic' rows (the Courses page's book list) are month-agnostic —
-- that page ignores period_date, so the backfill above is harmless to it.
