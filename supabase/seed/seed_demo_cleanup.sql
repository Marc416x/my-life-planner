-- ============================================================
-- DEMO SEED CLEANUP — removes every row created by seed_demo.sql.
-- Only deletes rows tagged term = 'SEED', so your real data is untouched.
-- Run in Supabase → SQL Editor.
-- ============================================================
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = 'jotemgouaserena@gmail.com';
  if uid is null then
    raise exception 'No auth user found for that email — check the address.';
  end if;

  delete from public.study_sessions where user_id = uid and term = 'SEED';
  delete from public.error_log      where user_id = uid and term = 'SEED';

  raise notice 'Removed all SEED demo rows for %.', uid;
end $$;
