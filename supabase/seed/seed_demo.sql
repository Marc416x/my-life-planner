-- ============================================================
-- DEMO SEED — fill ONE account with realistic Study Sessions + Error Log data
-- so you can see the pages "full". Every row is stamped term = 'SEED', which is
-- NOT shown anywhere in the UI, so the data looks real while you browse — and it
-- is fully reversible: run seed_demo_cleanup.sql to remove every seeded row.
--
-- Run in Supabase → SQL Editor. Safe to re-run (it just adds more demo rows).
-- Change the email below if you want to seed a different account.
-- ============================================================
do $$
declare
  uid        uuid;
  course_ids uuid[];
  n_courses  int;
begin
  select id into uid from auth.users where email = 'jotemgouaserena@gmail.com';
  if uid is null then
    raise exception 'No auth user found for that email — check the address.';
  end if;

  -- The user's own courses (so demo rows link to real courses when available).
  select array_agg(id) into course_ids from public.courses where user_id = uid;
  n_courses := coalesce(array_length(course_ids, 1), 0);

  -- ---- STUDY SESSIONS: ~400 sessions spread over the last ~180 days ----
  insert into public.study_sessions
    (user_id, course_id, topic, duration_min, focus, notes, session_date, started_at, term)
  select
    uid,
    case when n_courses > 0 then course_ids[1 + floor(random() * n_courses)::int] else null end,
    (array['Cardiac meds','Sorting algorithms','Pathophysiology','Pharmacokinetics','Ethics','Lab values','Dosage calc','Renal system','Data structures','Microbiology'])[1 + floor(random() * 10)::int],
    (15 + floor(random() * 90))::int,
    (1 + floor(random() * 5))::int,
    case when random() < 0.3 then 'Reviewed key concepts and worked through practice questions.' else null end,
    d::date,
    d::timestamptz + (floor(random() * 12) || ' hours')::interval,
    'SEED'
  from (
    select (current_date - floor(random() * 180)::int) as d
    from generate_series(1, 400)
  ) days;

  -- ---- ERROR LOG: ~45 entries over the last ~120 days ----
  insert into public.error_log
    (user_id, course_id, topic, prompt, correct, reason, source, resolved, notes, occurred_on, term)
  select
    uid,
    case when n_courses > 0 then course_ids[1 + floor(random() * n_courses)::int] else null end,
    (array['Beta blockers','Big-O notation','Acid-base balance','Drug half-life','Triage priority','Electrolytes','Recursion','Fluid balance'])[1 + floor(random() * 8)::int],
    'Missed a question about ' || (array['dosage','the mechanism of action','side effects','timing','contraindications','edge cases'])[1 + floor(random() * 6)::int] || '.',
    'The correct approach was to apply the underlying rule rather than guess.',
    (array['misread','knowledge_gap','careless','timing','other'])[1 + floor(random() * 5)::int],
    (array['Quiz','Exam','Clinical','Practice','Lecture'])[1 + floor(random() * 5)::int],
    random() < 0.5,
    case when random() < 0.4 then 'Memory hook: tie it back to the core principle.' else null end,
    (current_date - floor(random() * 120)::int)::date,
    'SEED'
  from generate_series(1, 45);

  raise notice 'Seeded demo data for %.', uid;
end $$;
