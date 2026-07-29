-- 0014_is_pro.sql
-- Pro flag: does this user have a Pro subscription?
-- There's no billing wired up yet — this is the single source of truth the app
-- reads to unlock Premium features (the term archive, the Premium nav sections).
--
-- FOR NOW everyone is Pro: the column defaults to true, and the statements below
-- make sure any existing rows are flipped on too (the ADD COLUMN alone is a no-op
-- if the column already exists, e.g. from an earlier default-false run). To make
-- Pro a paid tier later, change the default back to false and gate `is_pro`.
-- Run in Supabase → SQL Editor. Safe to re-run.

alter table public.profiles
  add column if not exists is_pro boolean not null default true;

-- Ensure the default + existing rows are Pro even if the column already existed.
alter table public.profiles alter column is_pro set default true;
update public.profiles set is_pro = true where is_pro is distinct from true;
