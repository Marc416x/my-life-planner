-- ============================================================
-- MyLifePlanner — Phase 1a schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
--
-- Every table is keyed by the owning user and locked down with Row-Level
-- Security, so a user can only ever read/write their own rows.
-- ============================================================

-- ---------- PROFILES (one row per auth user) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text default 'Student',
  gender      text default 'female',
  palette     int  default 0,
  year        text default 'Year 1',
  streak      int  default 0,
  level       int  default 1,
  daily_goal  int  default 3,
  weekly_goal int  default 21,
  sleep_goal  numeric default 8,
  water_goal  int  default 8,
  timezone    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_modify_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_modify_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- DAILY TASKS (Dashboard) ----------
create table if not exists public.daily_tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  text       text not null,
  tag        text,
  tag_class  text,
  done       boolean default false,
  task_date  date default current_date,
  created_at timestamptz default now()
);
create index if not exists daily_tasks_user_idx on public.daily_tasks (user_id);
alter table public.daily_tasks enable row level security;
drop policy if exists "daily_tasks_own" on public.daily_tasks;
create policy "daily_tasks_own" on public.daily_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- WEEKLY GOALS (Calendar → Weekly) ----------
create table if not exists public.weekly_goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  text       text not null,
  done       boolean default false,
  week_start date,
  created_at timestamptz default now()
);
create index if not exists weekly_goals_user_idx on public.weekly_goals (user_id);
alter table public.weekly_goals enable row level security;
drop policy if exists "weekly_goals_own" on public.weekly_goals;
create policy "weekly_goals_own" on public.weekly_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- READING LIST (Calendar monthly books + Courses academic books) ----------
-- kind: 'monthly' or 'academic'
create table if not exists public.reading_list (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  author     text,
  course     text,
  status     text,
  kind       text not null default 'monthly',
  created_at timestamptz default now()
);
create index if not exists reading_list_user_idx on public.reading_list (user_id);
alter table public.reading_list enable row level security;
drop policy if exists "reading_list_own" on public.reading_list;
create policy "reading_list_own" on public.reading_list
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- SCHEDULE BLOCKS (Class Schedule) ----------
create table if not exists public.schedule_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         text not null,
  start_label text not null,
  end_label   text,
  subject     text not null,
  type        text default 'sch-lecture',
  created_at  timestamptz default now()
);
create index if not exists schedule_blocks_user_idx on public.schedule_blocks (user_id);
alter table public.schedule_blocks enable row level security;
drop policy if exists "schedule_blocks_own" on public.schedule_blocks;
create policy "schedule_blocks_own" on public.schedule_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- COURSES (Courses page; feeds Grades) ----------
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  code        text,
  credits     int,
  professor   text,
  semester    text,
  difficulty  text,
  grade_pct   numeric,
  weight_pct  numeric,
  created_at  timestamptz default now()
);
create index if not exists courses_user_idx on public.courses (user_id);
alter table public.courses enable row level security;
drop policy if exists "courses_own" on public.courses;
create policy "courses_own" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
