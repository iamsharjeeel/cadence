# Cadence

A premium, multi-tenant timesheet portal. Employees submit timesheets; admins
approve them.

- **Phase 1 — foundation:** auth, multi-tenant orgs, role-based access,
  profile/employee management, and the design system.
- **Phase 2 — timesheets:** three-method upload (file / paste / Google Sheet),
  fuzzy header mapping, live validation, period overlap guard, submit/approve/
  reject with rate snapshots, and a dormant webhook seam.

> Not yet built (later phases): dashboards, charts, FX, live CFO webhook
> delivery. Clean, typed seams are left where these plug in.

## Phase 2 — Timesheets

- **Upload** (`/app/timesheets/new`) — one pipeline (parse → map → validate →
  submit) fed by three inputs:
  1. Drag/drop or browse (`.csv` / `.xlsx`; `.xlsm`/legacy rejected; 10MB cap;
     parsed in-browser via PapaParse + SheetJS).
  2. Clipboard paste (⌘/Ctrl + V) of tab-separated spreadsheet data.
  3. Public Google Sheet link (fetched server-side via `/api/google-sheet` to
     avoid CORS; never uses Google OAuth).
  - Header mapping auto-matches columns fuzzily and is **persisted per org** in
    `localStorage`, so repeat uploads skip straight to preview.
  - Live row-by-row validation; invalid rows are highlighted and deletable;
    submit is blocked while errors remain.
- **Submit** re-validates every row server-side, enforces a period-overlap
  guard, uploads the raw file to `timesheets/{org_id}/{employee_id}/{id}/raw`,
  inserts the timesheet + rows, and audits `timesheet_submitted`.
- **Review** (`/app/timesheets`) — employees see their own; admins see their
  org; superadmins see all (filter by status + employee). Approve snapshots the
  employee's **current** rate from the DB, computes the total server-side
  (`hourly = Σhours × rate`; salaried/fixed = rate), records approver/timestamp,
  inserts a dormant `webhook_deliveries` row, and audits `timesheet_approved`.
  Reject requires a note. File reads always use 1-hour **signed URLs**.

## Stack

- **Next.js 14** (App Router, TypeScript, `src/` directory)
- **Supabase** — Postgres + Auth + RLS via [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side)
- **Tailwind CSS** with CSS-variable theming + **next-themes** (light/dark)
- **GSAP** for motion
- Deploy target: **Vercel** · Package manager: **npm**

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev                        # http://localhost:3000
```

`npm run build` and `npm run typecheck` should both pass clean.

## Environment variables

These are already configured in Vercel. For local dev, set them in `.env.local`
(see `.env.local.example`):

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | public | App origin (OAuth redirect base) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Privileged writes. **Never** import client-side. |
| `SUPERADMIN_EMAIL` | **server-only** | Optional backstop — auto-promotes this email to superadmin on sign-in. |

The service-role client (`src/lib/supabase/admin.ts`) is guarded with
`import "server-only"`, so a build fails if it is ever pulled into a client
bundle.

## Auth & onboarding

- **Google OAuth only** — no email/password.
- On first sign-in, a DB trigger creates a `profiles` row as `pending` with no
  org.
- `/auth/callback` exchanges the code and runs onboarding:
  - **Domain-gating** — if the email domain matches exactly one org's
    `allowed_domains`, the user is attached to that org (status stays `pending`,
    awaiting admin approval). No / multiple matches → org stays null.
  - **Superadmin backstop** — if the email equals `SUPERADMIN_EMAIL`, the user
    is promoted to `superadmin` + `active`.
- `pending` / `suspended` users are blocked from `/app/**` and shown `/pending`.

### Roles

| Role | Can |
| --- | --- |
| `superadmin` | Platform layer — create/manage orgs, see everything (`/app/organizations`) |
| `admin` | Manage own org's employees, rates, approvals, settings; review/approve org timesheets |
| `employee` | View own profile; submit and view own timesheets |

> Superadmins also get the **Employees** tab — every member across all orgs (with
> an Org column) and the same approve / role / rate / status controls, scoped so
> superadmin can act on any org while admins are limited to their own.

## Bootstrapping the first superadmin

The database starts with no superadmin. After the intended superadmin has
**signed in with Google at least once** (so their `profiles` row exists),
promote them one of two ways:

1. **Env var (automatic):** set `SUPERADMIN_EMAIL` to their email. They're
   promoted on their next sign-in.
2. **Seed SQL (manual):** edit and run
   [`supabase/seed/bootstrap_superadmin.sql`](supabase/seed/bootstrap_superadmin.sql)
   in the Supabase SQL editor.

> The seed SQL must be run **after** the first Google sign-in, not before — the
> profile row is created by the signup trigger.

## Project structure

```
src/
  app/
    (marketing)/        # placeholder landing + Sign in CTA
    login/              # Google sign-in
    auth/callback/      # OAuth code exchange + domain-gating
    auth/signout/
    pending/            # waiting-for-approval / suspended screen
    app/                # authed, role-aware shell
      dashboard/        # role-aware greeting (Phase 3 placeholder)
      profile/          # edit own name; read-only rate/role/status
      employees/        # ADMIN — approval queue, role/rate/status
      organizations/    # SUPERADMIN — list/create orgs
      settings/         # ADMIN — edit own org
  components/           # ui primitives, motion, app shell, brand
  lib/
    supabase/           # client / server / admin / middleware clients
    auth.ts             # getProfile, requireRole, requireActiveProfile
    audit.ts            # writeAudit
    onboarding.ts       # domain-gating + superadmin backstop
    validation.ts       # slug / domain / currency / rate validators
  types/db.ts           # types generated from the existing schema
  middleware.ts         # session refresh + route guards
```

## Security model

- The service-role key is used **only** in server actions / route handlers.
- Every role/rate/status mutation re-checks the caller's role **server-side**;
  RLS is a backstop, not the sole gate.
- Employees can never set their own role, rate, or status — enforced in the
  server action, not just the UI.
- Audit-logged actions: profile approval, role change, rate change, status
  change, org creation, org update.
- Org `slug` uniqueness and `allowed_domains` format are validated server-side.

## Database

The schema already exists in Supabase (enums, `organizations`, `profiles`,
`audit_log`, RLS, the signup trigger, and the `auth_role()` / `auth_org()` /
`is_active()` helpers). This app does **not** recreate it. Regenerate types
after any schema change:

```bash
npx supabase gen types typescript --project-id <project-id> --schema public > src/types/db.ts
```
