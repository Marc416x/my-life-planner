-- 0010_profile_onboarding.sql
-- First-run flag: has this user completed the setup wizard?
-- Existing rows default to false on purpose, so everyone walks the wizard once.
-- (To skip that for current users instead: `update public.profiles set onboarded = true;`)

alter table public.profiles
  add column if not exists onboarded boolean not null default false;
