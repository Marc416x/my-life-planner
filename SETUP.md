# Setup & Local Development

MyLifePlanner is a Next.js 16 (App Router, TypeScript) app styled with Tailwind v4
+ shadcn/ui, with Supabase planned for data/auth. This file covers running it
locally and the two steps that need **your** accounts.

## Prerequisites (already done)

- **Node.js LTS** (v24.18.0) — installed via winget during Phase 0.
- All npm dependencies are installed.

> Note: after installing Node, open a **fresh terminal** so `node` and `npm` are on
> your PATH. Verify with `node -v` (should print v24.x).

## Run it locally

```bash
npm run dev
```

Then open <http://localhost:3000>. You should see the dashboard shell. Test it:

- **Resize to phone width** (~375px) — nothing should overflow horizontally.
- On mobile width, the sidebar collapses into a hamburger → slide-in drawer.
- The **sun/moon button** (top-right) toggles light/dark.

Other scripts: `npm run build` (production build), `npm run lint` (ESLint).

## What's in place

- **Fonts:** Fraunces (headings) + Nunito (body), via `next/font`.
- **Palette:** Earthy Boho ported to theme tokens for light + dark, plus
  `bg-terracotta` / `text-forest` / etc. brand utilities. (`src/app/globals.css`)
- **Shell:** `src/components/app-shell.tsx` (responsive nav + drawer),
  `src/components/theme-toggle.tsx`, `src/lib/nav.ts`.
- **Supabase clients:** `src/lib/supabase/client.ts` (browser) and
  `src/lib/supabase/server.ts` (server). Not wired to auth yet — that's Phase 1.
- **Old prototype:** preserved read-only under `legacy-prototype/` as the spec.

---

## Step 1 — Create your Supabase project (needs your account)

1. Sign up / log in at <https://supabase.com> (free tier is fine).
2. Create a new project. Pick a region close to you; save the database password.
3. In the project: **Project Settings → API**. Copy:
   - **Project URL**
   - **anon / public** key
4. Paste them into `.env.local` in this repo:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

5. Restart `npm run dev` so it picks up the new env vars.

> The anon key is meant to be public — Row-Level Security (added in Phase 1) is
> what actually protects each user's data. `.env.local` is git-ignored.

## Step 2 — Deploy to Vercel (needs your account)

1. Push this repo to GitHub (see below), then log in at <https://vercel.com> with
   that GitHub account.
2. **Add New → Project → import** this repository. Vercel auto-detects Next.js.
3. Add the two environment variables (same as `.env.local`) in the Vercel project
   settings before/at first deploy.
4. Deploy. You'll get a live `*.vercel.app` URL — that's the pipeline proven.

### Pushing to GitHub

```bash
# create an empty repo on github.com first (no README), then:
git add .
git commit -m "Phase 0: Next.js scaffold + design system + shell"
git remote add origin https://github.com/YOUR-USERNAME/my-life-planner.git
git push -u origin main
```

Once both steps are done, Phase 0 is fully complete and we can start Phase 1
(schema + real auth + rebuilding features).
