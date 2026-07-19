# MyLifePlanner — Build Roadmap

> **What this is:** a nursing-student academic OS (NCLEX tracker, drug/pharmacology
> tracker, clinical hours, GPA, planner). The niche focus is a strength — keep it.
>
> **Current state:** a polished but throwaway prototype (vanilla HTML/CSS/JS, ~30
> global variables, no build step, no backend). It defines the *look and feature set*
> — we mine it for logic and design intent, then rebuild the frontend properly.
>
> **Agreed strategy (long-term-first):**
>
> - **Full rewrite** of the frontend in **Next.js + TypeScript**.
> - **Tailwind CSS** for a mobile-first, responsive design system.
> - **shadcn/ui** for accessible components we own and can fully modify.
> - **Lucide** icons to replace emojis.
> - **next/font** to cut fonts down to 1–2.
> - **Supabase** (Postgres + Auth + Row-Level Security) for DB/auth.
> - Next.js API routes / server actions host the server bits (Stripe webhook, AI proxy)
>   — no separate backend to run.
> - Monetization (Stripe) waits until the free product is sticky.
> - Target cost: ~$0/mo until real usage forces a paid tier (Vercel + Supabase free tiers).

---

## Why this stack (the reasoning, so it stays intentional)

| Piece | Choice | Problem it solves |
|---|---|---|
| Language | TypeScript | Loose JS + globals today → types make the code refactor-safe and self-documenting |
| Framework | Next.js (React) | Long-term ecosystem + a backend in the same deploy (Stripe/OAuth/AI) |
| Styling | Tailwind CSS | Root fix for **responsiveness** — mobile-first is the default |
| Components | shadcn/ui | Accessible, responsive, copied into the repo → fully modifiable |
| Icons | Lucide | Replaces **emojis** with swappable SVG icons |
| Fonts | next/font | Fonts declared once → drop from ~3 to **1–2** |
| DB / Auth | Supabase | Free tier; Row-Level Security = users only see their own data |

**Reality check that shaped this plan:** a framework does not fix responsiveness by
itself — the *styling system and discipline* do. Tailwind + shadcn/ui are what actually
prevent the "boxes break out of the screen" and "unreachable options" bugs. The rewrite
is the opportunity to do it right; the tooling makes doing it right the easy path.

---

## Design-system rules (address the 3 pain points at the root)

These are non-negotiable conventions for the rebuild:

1. **Mobile-first, always.** Every screen is built and tested at 375px width *first*,
   then scaled up with Tailwind breakpoints. No fixed pixel widths on containers; no
   horizontal overflow. (Fixes login boxes breaking out, unreachable calendar options.)
2. **Icons via one component.** All icons come from Lucide through a single `<Icon>`
   wrapper — never inline emojis in UI. Swapping an icon is a one-line change.
3. **Fonts declared once.** Max 1–2 typefaces, configured in `next/font` + Tailwind
   theme. No ad-hoc `font-family` in components.
4. **Design tokens over magic values.** Colors, spacing, radii live in the Tailwind
   theme (port the 16 palettes from `state.js` into theme tokens).

---

## Phase 0 — Scaffold + design foundations (no features yet)

- [x] Install Node.js LTS (was not installed — done via winget, v24.18.0).
- [x] `git init` the project.
- [x] Create the Next.js app: TypeScript, App Router, Tailwind v4, ESLint.
      (Next 16.2.10, React 19.2.4.)
- [x] Install and initialize shadcn/ui (base-nova style) and Lucide.
- [x] Configure `next/font`: **Fraunces** (headings) + **Nunito** (body).
- [x] Port the Earthy Boho palette into Tailwind theme tokens (light + dark),
      plus raw brand-color utilities (terracotta/olive/ochre/forest).
- [x] Build a responsive app shell: sidebar on desktop, off-canvas drawer on
      mobile, plus a light/dark toggle and a dashboard placeholder.
- [x] Add the Supabase client helpers (browser + server) + env placeholders.
- [x] Verify a clean production build (`npm run build` passes).
- [ ] **(needs your account)** Create a Supabase project (free tier); paste its
      URL + anon key into `.env.local`. See `SETUP.md`.
- [ ] **(needs your account)** Deploy to Vercel to prove the pipeline. See `SETUP.md`.

**Exit criteria:** an empty but responsive app shell with the design system in
place. Resize to phone width — nothing overflows. *(Local build ✓; the deploy +
Supabase-project steps need your accounts — documented in `SETUP.md`.)*

---

## Phase 1 — Rebuild the working features (responsive + persistent)

Rebuild each already-working feature as typed React components on Supabase.
The *logic* ports over nearly as-is; the *UI* is rebuilt to the design-system rules.

### 1a. Data + auth foundation

- [ ] Schema (one table per data type, all keyed by `user_id`): `profiles`,
      `daily_tasks`, `weekly_goals`, `reading_list`, `schedule_blocks`,
      `calendar_events`, `trackers`, `drug_log`, `nclex_sessions`, `courses`.
- [ ] Row-Level Security (`user_id = auth.uid()`) on every table.
- [ ] Real auth with Supabase Auth: email + Google OAuth (replaces the mock login).
- [ ] Session restore on reload; protected routes.

### 1b. Feature screens (rebuild UI, port logic, wire to DB)

- [ ] Planner — daily tasks, weekly goals, reading lists
- [ ] Calendar — year/month/streak views + editable weekly schedule
      *(explicitly fix the daily-view unreachable-options bug during rebuild)*
- [ ] Trackers — sleep, water, clinical hours, custom
- [ ] Drug tracker + spaced-recall quiz
- [ ] NCLEX session logging + readiness dashboard
- [ ] GPA / courses (port `pctToGradePoint` + credit-weighted logic verbatim — it's correct)
- [ ] Streaks + profile/goals
- [ ] Data export (CSV + printable PDF)
- [ ] Themes/palettes + onboarding, persisted to `profiles`

### 1c. Account types

- [ ] Keep individual accounts only for MVP. Institutional/admin stays "coming soon."

**Exit criteria:** sign up, use every core feature on a phone with no layout breakage,
sign in on another device, data intact. This is "functional enough for real users."

---

## Phase 1.5 — Cheap finishing touches

- [ ] Notification *preferences* persisted (delivery deferred to Phase 3).
- [ ] Empty / loading / error states for all data screens.
- [ ] Server-side input validation (don't trust the client).
- [ ] Accessibility pass (shadcn/ui gives a strong baseline; verify focus + contrast).

---

## Phase 2 — Monetization (only after Phase 1 shows retention)

Gate: only start once real users are returning to the free product.

- [ ] Decide what's Premium (candidates: NCLEX analytics, AI assistant, export).
- [ ] `subscriptions` table + `is_premium` derived from Stripe state.
- [ ] Stripe-hosted Checkout for monthly/yearly.
- [ ] Stripe webhook as a Next.js API route → updates subscription status.
- [ ] Stripe billing portal for manage/cancel.
- [ ] Premium gating enforced **server-side** (never trust a client flag).

---

## Phase 3 — Shelved features, built for real (demand-driven)

- [ ] **AI Study Assistant** — replace pattern-matched replies with a real model behind
      a Next.js API route (keeps keys server-side). Strict per-user usage caps; Premium.
- [ ] **Notification delivery** — web push + transactional email via scheduled jobs.
- [ ] **Study groups / chat / leaderboards** — real multi-user via Supabase Realtime;
      invite flow, membership, moderation. Non-trivial — scope carefully.

---

## Phase 4 — Institutional product (separate bet, shelve hardest)

Effectively a second product (multi-tenant admin analytics). Do **not** start until
individual traction is proven and, ideally, a school will pay.

- [ ] Multi-tenant model (institutions, cohorts, roles).
- [ ] Student consent flow for sharing grades with admins.
- [ ] Strict tenant data isolation (RLS + tenant scoping).
- [ ] Admin dashboard: cohort analytics, enrollment management.
- [ ] Institutional billing.

---

## Explicitly deferred / not doing yet

- **Translations / multi-language (i18n).** The app is **English-only**. The old
  EN/FR toggle is dropped, not ported. Revisit only if there's real demand later.
- Native mobile apps — the responsive web app covers mobile.
- Real-time collaboration beyond study groups.
- Any institutional/admin feature before individual traction.

---

## Suggested order of attack

1. Phase 0 — scaffold Next.js + design system, deploy the empty shell.
2. Phase 1a → 1b → 1c — rebuild features, responsive + persistent.
3. Phase 1.5 — polish + a11y.
4. **Ship. Get real users. Measure retention.**
5. Only then: Phase 2 (Stripe), and Phase 3 features by demand.

---

## Reference: what to salvage from the old prototype

The vanilla app is now a **spec, not a codebase.** Reuse:

- **Logic to port verbatim:** GPA/grade-point (`grades.js`), NCLEX scoring +
  readiness (`premium-features.js`), drug quiz spaced-recall, calendar date math
  (`calendar.js`).
- **Design intent:** the 16 color palettes (`state.js`), layout structure, feature set.
- **Discard:** all the mock auth/Stripe/AI/groups plumbing, the EN/FR i18n toggle
  (`i18n.js`), and the global-variable state model — replaced by Supabase + typed
  React state.
