-- ============================================================
-- MyLifePlanner — Class Schedule: real time model
-- The original schedule_blocks (0001) stored times only as display strings
-- (start_label / end_label like "9:00 AM"), which can't be placed on a grid,
-- sized by duration, sorted, or overlap-checked. Add integer minutes-from-
-- midnight columns and backfill them from the existing labels.
-- The app keeps start_label / end_label in sync for display; start_min/end_min
-- are the source of truth for layout. Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

alter table public.schedule_blocks
  add column if not exists start_min int,
  add column if not exists end_min   int;

-- Backfill from the old text labels ("9:00 AM" → 540, "2:30 PM" → 870).
update public.schedule_blocks
   set start_min = extract(hour   from to_timestamp(start_label, 'HH12:MI AM')) * 60
                 + extract(minute from to_timestamp(start_label, 'HH12:MI AM'))
 where start_min is null and start_label is not null and start_label <> '';

update public.schedule_blocks
   set end_min = extract(hour   from to_timestamp(end_label, 'HH12:MI AM')) * 60
               + extract(minute from to_timestamp(end_label, 'HH12:MI AM'))
 where end_min is null and end_label is not null and end_label <> '';
