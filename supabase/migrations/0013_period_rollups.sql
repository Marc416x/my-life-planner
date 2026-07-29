-- ============================================================
-- Period roll-ups for the "Group by: Week / Month" views.
-- These aggregate in the DB (one small result set per call) instead of pulling
-- every row into the browser — so the Week/Month summaries stay correct and fast
-- no matter how much history a user has piled up.
--
-- SECURITY INVOKER (the default): the functions run as the calling user, so RLS
-- applies and auth.uid() is the signed-in user. The explicit user_id filter is
-- belt-and-suspenders.
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- Study sessions grouped by week or month → (period_start, count, total minutes).
create or replace function public.study_session_periods(p_gran text)
returns table (period_start date, cnt bigint, total_min bigint)
language sql
stable
as $$
  select date_trunc(p_gran, session_date::timestamp)::date as period_start,
         count(*)                                           as cnt,
         coalesce(sum(duration_min), 0)                     as total_min
  from public.study_sessions
  where user_id = auth.uid()
    and p_gran in ('week', 'month')
  group by 1
  order by 1 desc
$$;

-- Error log grouped by week or month → (period_start, count, still-open count).
create or replace function public.error_log_periods(p_gran text)
returns table (period_start date, cnt bigint, open_cnt bigint)
language sql
stable
as $$
  select date_trunc(p_gran, occurred_on::timestamp)::date  as period_start,
         count(*)                                           as cnt,
         count(*) filter (where not resolved)               as open_cnt
  from public.error_log
  where user_id = auth.uid()
    and p_gran in ('week', 'month')
  group by 1
  order by 1 desc
$$;

grant execute on function public.study_session_periods(text) to authenticated;
grant execute on function public.error_log_periods(text)     to authenticated;
