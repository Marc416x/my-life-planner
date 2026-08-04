-- ============================================================
-- MyLifePlanner — de-duplicate trackers + make seeding safe
--
-- BUG: every preset tracker (Sleep, Water, Mood, …) appeared TWICE, and the
-- Calendar's mood buttons didn't move the Mood tracker's value.
--
-- CAUSE: the Trackers page seeds presets on first visit with a check-then-insert
-- ("no trackers? insert the five presets"). React Strict Mode — on by default
-- with the App Router — double-invokes mount effects in dev, so both runs read
-- zero trackers before either INSERT landed and both seeded. Nothing in the
-- schema forbade it: 0016 has no uniqueness on (user_id, name).
--
-- The duplicate definitions then split the entries. `tracker_entries` is keyed by
-- tracker_id, so logging Mood from Trackers wrote to one row while the Calendar's
-- `name = 'Mood' LIMIT 1` (no ORDER BY → arbitrary) read the other.
--
-- This migration repairs existing data and makes a repeat impossible. The page
-- also switches to an idempotent upsert so it no longer depends on luck.
--
-- Run in Supabase → SQL Editor. Safe to re-run (idempotent by construction).
-- ============================================================

-- ---------- 1. Move entries off duplicates onto the keeper ----------
-- Keeper per (user_id, name) = the earliest created row; `id` breaks ties so the
-- choice is deterministic. Entries move only where the keeper has no value for
-- that day yet — `tracker_entries` is unique on (tracker_id, entry_date), and the
-- keeper's own value is the one to trust when both logged the same day.
-- `distinct on` matters: with 3+ copies of a name, two duplicates could hold an
-- entry for the SAME day, and moving both would collide on (tracker_id,
-- entry_date) inside this one statement. Pick exactly one entry per
-- (keeper, day) — the earliest duplicate's — and let the rest cascade in step 2.
with ranked as (
  select id,
         row_number() over (partition by user_id, name order by created_at, id) as rn,
         first_value(id) over (partition by user_id, name order by created_at, id) as keeper_id
    from public.trackers
),
movable as (
  select distinct on (r.keeper_id, e.entry_date)
         e.id as entry_id,
         r.keeper_id
    from public.tracker_entries e
    join ranked r on e.tracker_id = r.id and r.rn > 1
   where not exists (
     select 1
       from public.tracker_entries k
      where k.tracker_id = r.keeper_id
        and k.entry_date = e.entry_date
   )
   order by r.keeper_id, e.entry_date, r.rn, e.created_at
)
update public.tracker_entries e
   set tracker_id = m.keeper_id
  from movable m
 where e.id = m.entry_id;

-- ---------- 2. Drop the duplicate definitions ----------
-- Any entry still pointing at a duplicate collided with a keeper value for the
-- same day; `tracker_entries.tracker_id ... on delete cascade` (0016) removes
-- those, which is the intended outcome — the keeper's value survives.
with ranked as (
  select id,
         row_number() over (partition by user_id, name order by created_at, id) as rn
    from public.trackers
)
delete from public.trackers t
 using ranked r
 where t.id = r.id
   and r.rn > 1;

-- ---------- 3. Make it structurally impossible ----------
-- One tracker per name per user. Seeding can now be an upsert that no-ops on
-- conflict, so a double-invoked effect (or a double-click, or two tabs) is safe.
-- NOTE: this counts ARCHIVED trackers too — an archived "Mood" keeps the name.
-- Rename the archived one if you ever want to start a fresh tracker of the same
-- name; that beats silently accumulating duplicates again.
create unique index if not exists trackers_user_name_idx
  on public.trackers (user_id, name);
