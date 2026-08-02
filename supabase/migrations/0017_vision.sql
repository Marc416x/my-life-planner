-- ============================================================
-- MyLifePlanner — Long Term Vision (Wellbeing)
-- The "bigger picture" page. Two stores:
--   • profiles.vision_statement — a free-text reflection ("what kind of nurse
--     do you want to be in 5 / 10 / 20 years?"). One per user → a profile column.
--   • vision_items             — a single list of aspirations rendered two ways:
--       kind='milestone' → a dated career-goal TIMELINE (Done / Active / Future)
--       kind='dream'     → a visual DREAM-BOARD card  (icon + tone + target year)
--     One table, one code path — the Trackers "generic engine" idea (0016).
--
-- LONG-TERM by definition: this is your 5/10/20-year picture, so it is
-- term-AGNOSTIC. It carries across academic terms untouched and never archives
-- (contrast Study / Trackers entries, which stamp `term` — see 0015/0016).
--
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- Vision statement (singleton — a profile column) ----------
alter table public.profiles
  add column if not exists vision_statement text;

-- ---------- Vision items (milestones + dream-board cards) ----------
create table if not exists public.vision_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null default 'milestone'
                check (kind in ('milestone', 'dream')),
  title       text not null,
  target_year int,                                 -- the year you aim to reach it; null = someday
  status      text not null default 'active'
                check (status in ('done', 'active', 'future')),
  note        text,                                -- optional detail (timeline caption / dream note)
  tone        text not null default 'terracotta'
                check (tone in ('terracotta', 'olive', 'ochre', 'forest')),
  icon        text not null default 'Star',        -- lucide icon name (see the page's ICONS map)
  sort_order  int  not null default 0,
  created_at  timestamptz default now()
);
-- Pages fetch one kind at a time, ordered — index matches (user, kind, order).
create index if not exists vision_items_user_idx
  on public.vision_items (user_id, kind, sort_order);

alter table public.vision_items enable row level security;
drop policy if exists "vision_items_own" on public.vision_items;
create policy "vision_items_own" on public.vision_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
