-- ============================================================
-- MyLifePlanner — Term archive
-- Turns the `term` stamp (e.g. "Year 1") into a real archive: the app shows the
-- CURRENT term by default; once a student advances a year, the old term becomes
-- a read-only, Pro-gated history you can switch back to.
--
-- "Current term" = a row whose term is the profile's current `year`, OR is NULL
-- (legacy/unstamped rows), OR is the reserved 'SEED' demo sentinel (so demo data
-- always shows and never poses as an archived term). A "past term" is any other
-- distinct non-null term value.
--
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- 1) Clinicals joins the term system ----------
alter table public.clinical_sessions
  add column if not exists term text;

-- Backfill existing clinical rows to the user's current year so they read as
-- "current" now and archive naturally when the student advances a year. (There's
-- no per-row signal for which past year an old session belonged to; current-year
-- is the pragmatic default. New rows are stamped by the app at insert.)
update public.clinical_sessions cs
   set term = p.year
  from public.profiles p
 where cs.user_id = p.id
   and cs.term is null;

create index if not exists clinical_sessions_term_idx
  on public.clinical_sessions (user_id, term);

-- ---------- 2) Which terms does the user have data in? ----------
-- One small result set the term picker reads on each logging page. Returns every
-- distinct non-null term per source with a row count; the client drops the
-- current term + the 'SEED' sentinel to get the list of *archived* terms.
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
$$;

grant execute on function public.user_terms() to authenticated;

-- ---------- 3) Term-aware roll-ups (Week / Month summaries) ----------
-- Extended with p_scope so the archive's Week/Month totals stay correct:
--   p_scope IS NULL  → the current term (year + NULL + SEED)
--   p_scope = '<term>' → exactly that archived term
-- Dropped first because adding a parameter changes the signature.
drop function if exists public.study_session_periods(text);
create or replace function public.study_session_periods(p_gran text, p_scope text default null)
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
    and case
          when p_scope is null
            then (term is null or term = 'SEED'
                  or term = (select year from public.profiles where id = auth.uid()))
          else term = p_scope
        end
  group by 1
  order by 1 desc
$$;

drop function if exists public.error_log_periods(text);
create or replace function public.error_log_periods(p_gran text, p_scope text default null)
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
    and case
          when p_scope is null
            then (term is null or term = 'SEED'
                  or term = (select year from public.profiles where id = auth.uid()))
          else term = p_scope
        end
  group by 1
  order by 1 desc
$$;

grant execute on function public.study_session_periods(text, text) to authenticated;
grant execute on function public.error_log_periods(text, text)     to authenticated;
