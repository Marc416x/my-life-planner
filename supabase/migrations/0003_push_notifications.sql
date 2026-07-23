-- ============================================================
-- MyLifePlanner — Push notifications (Assignments Stop 3)
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- One row per browser/device the user has opted in from.
-- `endpoint` is the unique push URL; `p256dh` + `auth` are the encryption keys
-- the Web Push protocol needs. Together they form the PushSubscription payload.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Per-user notification preferences. One row per user (id = user id).
-- `enabled` is the master switch; the three booleans map to the chosen triggers.
create table if not exists public.notification_prefs (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  enabled      boolean not null default true,
  planner_due  boolean not null default true,  -- 2 days before actual due
  due_morning  boolean not null default true,  -- morning of actual due date
  overdue      boolean not null default true,  -- once it passes the due date
  updated_at   timestamptz default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists "notification_prefs_own" on public.notification_prefs;
create policy "notification_prefs_own" on public.notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Dedup ledger (used by the daily cron in Stop 3b): records that a given
-- reminder kind was already sent for an assignment on a given day, so the
-- same nudge never fires twice. Unique key enforces that.
create table if not exists public.reminder_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  kind          text not null,   -- planner_due | due_morning | overdue
  sent_on       date not null,
  created_at    timestamptz default now(),
  unique (assignment_id, kind, sent_on)
);

create index if not exists reminder_log_user_idx
  on public.reminder_log (user_id);

alter table public.reminder_log enable row level security;

-- Users may read their own log; writes happen server-side via the service role,
-- which bypasses RLS. No client-side insert policy is intentional.
drop policy if exists "reminder_log_read_own" on public.reminder_log;
create policy "reminder_log_read_own" on public.reminder_log
  for select using (auth.uid() = user_id);
