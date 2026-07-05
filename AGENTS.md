# AGENTS.md

## Cursor Cloud specific instructions

Cadence is a single Next.js 14 (App Router, `src/`) + Supabase timesheet/people-ops
app. There is one service: the Next.js dev server on port 3000. Standard scripts
live in `package.json` (`dev`, `build`, `start`, `lint`, `typecheck`); env vars are
documented in `README.md` and `.env.local.example`. Dependencies install with
`npm install` (already run by the startup update script).

Non-obvious setup/run caveats:

- **`.env.local` is required for the app to run at all.** Copy `.env.local.example`
  → `.env.local`. The middleware (`src/middleware.ts`) runs on *every* route
  (including the public landing page) and calls Supabase `auth.getUser()`, so a
  reachable `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are needed
  before any page will render. `DOCUMENT_ENCRYPTION_KEY` can be any string ≥16 chars.
- **The real Cadence Supabase backend is not present in this environment.** Its
  URL/anon/`SUPABASE_SERVICE_ROLE_KEY` must be supplied as secrets. Most server-side
  paths (`createAdminClient` in `src/lib/supabase/admin.ts` — onboarding, `/api/v1/*`,
  API keys, many server actions) throw without `SUPABASE_SERVICE_ROLE_KEY`.
- **Do NOT use the Supabase MCP `SimpleOps` project as this app's backend.** It is a
  *different* application (task-management/chat schema — e.g. its `time_entries` has
  `task_id`/`duration_seconds`, not Cadence's `entry_date`/`decimal_hours`/`org_id`).
  Never apply this repo's migrations there. Cadence needs its own project.
- **Auth is Google-OAuth only** (no email/password UI). To test any authenticated
  flow you need a Supabase project with the Google provider enabled and
  `http://localhost:3000/auth/callback` in its redirect allow-list, plus a Google
  test account. Unauthenticated protected routes (`/app/*`) correctly 307-redirect
  to `/login`.
- **Database:** migrations in `supabase/migrations/` are applied in filename order
  (`supabase db push` or SQL editor); superadmin seed is `supabase/seed/bootstrap_superadmin.sql`.
  Note the code references an `api_keys` table (used by `/api/v1/*`) that has no
  migration in this repo state, so the API-key path won't work on a fresh DB from
  these migrations alone.
- Optional integrations (Resend email, Asana OAuth, Google Calendar) degrade
  gracefully when their env vars are unset.
