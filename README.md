# Job Tracker

A private tracker for job applications: one table with search, filters, and a
click-to-edit modal, plus follow-up reminders and pipeline stats. Next.js on Vercel,
MongoDB Atlas for storage, Google sign-in locked to an allowlist of accounts.

## What it does

- **Table** of every application — company, role, status, applied date, next action,
  source, last updated. Click any column header to sort; click any row to edit it.
- **Search** across company, role, notes, location and contact name.
- **Filter** by status, work mode, source, applied-date range, next-action range, and
  "gone quiet". Every filter lives in the URL, so a filtered view is bookmarkable and
  the back button works.
- **Status pipeline** — Saved → Applied → OA → Interview → Offer / Rejected / Ghosted.
  Every move is written to an append-only timeline server-side, so the history is
  never something the browser made up.
- **Follow-up reminders** — set a next-action date and it surfaces in the strip at the
  top on the day it's due.
- **Stale alerts** — anything sitting untouched past its status threshold (Applied
  14 days, OA 7, Interview 10) gets an amber "quiet 18d" badge.
- **Stats** — counts per status, response rate, interview rate, offers, median days to
  first reply, and applications sent per week for the last 8 weeks.
- **CSV export** that respects the filters currently applied.

## Setup

### 1. MongoDB Atlas

1. Create a free **M0** cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Database Access** → add a database user; copy the password.
3. **Network Access** → allow `0.0.0.0/0`. Vercel's egress IPs aren't static on the
   free plan, so an IP allowlist won't work.
4. **Database → Connect → Drivers** → copy the `mongodb+srv://…` string and paste your
   password into it.

### 2. Google OAuth

1. [console.cloud.google.com](https://console.cloud.google.com) → new project.
2. **APIs & Services → OAuth consent screen** → External → Testing. Add your own
   address under *Test users*.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-app>.vercel.app/api/auth/callback/google` (add after the first
     deploy, once you know the domain)
4. Copy the client ID and secret.

### 3. Local environment

```bash
cp .env.local.example .env.local
npx auth secret          # writes AUTH_SECRET
```

Fill in `MONGODB_URI`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and the two
allowlists: `ADMIN_EMAILS` (accounts that can read and edit) and `VIEW_EMAILS`
(accounts that can only read). An account on neither list cannot sign in; empty
lists lock everyone out — this deliberately does not fail open. `ALLOWED_EMAILS`
is still read as an admin list when `ADMIN_EMAILS` is unset.

```bash
npm install
npm run dev              # http://localhost:3000
```

### 4. Deploy

Push to GitHub, import the repo on Vercel, paste the same env vars into
**Settings → Environment Variables**, deploy, then add the production callback URL to
the Google client from step 2.

To change who can sign in or move someone between admin and view-only, edit
`ADMIN_EMAILS` / `VIEW_EMAILS` in **Settings → Environment Variables** and redeploy
— no code change needed.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm test` | Unit tests for the filter, stats, stale and CSV logic |
| `npm run lint` | ESLint |

## Layout

```
src/lib/        filters.ts, stats.ts, stale.ts, csv.ts — pure, unit-tested logic
                mongodb.ts (pooled client), serialize.ts (validation + shaping)
src/app/api/    applications CRUD + CSV export
src/components/ AppShell owns URL state; the rest are presentational
src/auth.ts     NextAuth config — the admin/view email allowlists
src/proxy.ts    route protection
```

`filters.ts` is imported by both the client and the API routes, so the filter → query
translation exists in exactly one place.

## Trying it without Atlas

If you want to poke at the UI before any cloud setup exists:

```bash
DISABLE_AUTH=1 npm run dev:local
```

That boots a throwaway in-memory MongoDB, seeds four sample applications, and starts
the dev server with sign-in bypassed. Nothing persists — the database dies with the
process. `DISABLE_AUTH` is double-gated on `NODE_ENV !== "production"`, so it cannot
unlock the deployed app.

## A note on dates

All dates are formatted with fixed month names and compared as **UTC** calendar days.
This is deliberate: the app renders on the server (UTC on Vercel) and again in your
browser (IST), and anything locale- or timezone-dependent makes the two disagree —
`Sep 1` against `1 Sept` — which React reports as a hydration error and recovers from
by throwing away the server's HTML.

The practical consequence is that a follow-up dated today starts showing as due at
05:30 IST rather than at midnight. For day-granularity reminders that is a fair trade
for markup that is identical wherever it renders. `src/lib/dates.ts` is the only place
dates are formatted; its tests assert fixed strings and are run across several
timezones, so a regression here fails loudly.
