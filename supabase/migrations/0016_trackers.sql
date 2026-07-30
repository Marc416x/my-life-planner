-- ============================================================
-- MyLifePlanner — Trackers (wellbeing / habit logging)
-- A generic tracker engine so the same code drives Sleep, Water, Mood, … AND
-- any custom tracker the user invents:
--   • `trackers`         — the metric DEFINITIONS (name, kind, unit, target…).
--   • `tracker_entries`  — the daily values logged against them.
--
-- ONE entry per (tracker, day): the entry's `value` IS that day's number. A water
-- stepper edits the same row up and down; a sleep reading upserts it. This keeps
-- the trend trivial (each day already has one value — nothing to re-aggregate).
--
-- Definitions PERSIST across academic terms — your "drink water" habit carries
-- Year 1 → Year 2. Only ENTRIES carry the `term` stamp, so past terms archive
-- read-only exactly like Study / Error Log / Clinicals. See src/lib/term.ts +
-- migration 0015. Indexes are (user_id, date desc) so a page fetches a small
-- recent window per user, never an ever-growing list.
--
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- TRACKERS (metric definitions — term-agnostic) ----------
create table if not exists public.trackers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  kind        text not null default 'count'
                check (kind in ('count', 'duration', 'scale', 'yesno', 'number')),
  unit        text,                              -- "glasses", "h", "min", "kg" … (free text)
  target      numeric,                           -- daily goal; null = no target
  tone        text not null default 'terracotta'
                check (tone in ('terracotta', 'olive', 'ochre', 'forest')),
  icon        text not null default 'Activity',  -- lucide icon name (see the page's ICONS map)
  sort_order  int  not null default 0,
  active      boolean not null default true,     -- archived (hidden) trackers stay for history
  created_at  timestamptz default now()
);
create index if not exists trackers_user_idx on public.trackers (user_id, sort_order);

alter table public.trackers enable row level security;
drop policy if exists "trackers_own" on public.trackers;
create policy "trackers_own" on public.trackers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- TRACKER ENTRIES (one value per tracker per day) ----------
create table if not exists public.tracker_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tracker_id  uuid not null references public.trackers (id) on delete cascade,
  entry_date  date not null default current_date,
  value       numeric not null,
  note        text,
  term        text,                              -- academic-term stamp (entries archive; definitions don't)
  created_at  timestamptz default now(),
  unique (tracker_id, entry_date)                -- the day's single value; upsert to change it
);
create index if not exists tracker_entries_user_idx on public.tracker_entries (user_id, entry_date desc);
create index if not exists tracker_entries_tracker_idx on public.tracker_entries (tracker_id, entry_date desc);

alter table public.tracker_entries enable row level security;
drop policy if exists "tracker_entries_own" on public.tracker_entries;
create policy "tracker_entries_own" on public.tracker_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Term-aware roll-up for the "Group by: Week / Month" view ----------
-- Entries are heterogeneous across trackers (glasses + hours + a 1–5 mood can't
-- be summed into one number), so a period rolls up to COUNTS, not a total:
-- how many values were logged and on how many distinct days. Same (p_gran,
-- p_scope) shape as study_session_periods (migration 0015):
--   p_scope IS NULL   → the current term (year + NULL + SEED)
--   p_scope = '<term>' → exactly that archived term
create or replace function public.tracker_entry_periods(p_gran text, p_scope text default null)
returns table (period_start date, cnt bigint, day_cnt bigint)
language sql
stable
as $$
  select date_trunc(p_gran, entry_date::timestamp)::date as period_start,
         count(*)                                          as cnt,
         count(distinct entry_date)                        as day_cnt
  from public.tracker_entries
  where user_id = auth.uid()
    and p_gran in ('week', 'month')
    and case
          when p_scope is null
            then (term is null or term = 'SEED'
                  or term = (select year from public.profiles where id = auth.uid()))
          else term = p_scope
        end
  group by 1
  order by 1 desc
$$;

grant execute on function public.tracker_entry_periods(text, text) to authenticated;

-- ---------- Trackers join the global term picker ----------
-- A past term with tracker entries should appear in Settings' archive list even
-- if the user logged nothing else that term. Extends user_terms() (migration
-- 0015) with a tracker_entries union — everything else is unchanged.
create or replace function public.user_terms()
returns table (source text, term text, cnt bigint)
language sql
stable
as $$
  select 'study'::text, term, count(*)
    from public.study_sessions
   where user_id = auth.uid() and term is not null
   group by term
  union all
  select 'error'::text, term, count(*)
    from public.error_log
   where user_id = auth.uid() and term is not null
   group by term
  union all
  select 'clinical'::text, term, count(*)
    from public.clinical_sessions
   where user_id = auth.uid() and term is not null
   group by term
  union all
  select 'tracker'::text, term, count(*)
    from public.tracker_entries
   where user_id = auth.uid() and term is not null
   group by term
$$;

grant execute on function public.user_terms() to authenticated;
