# Cadence

A premium, multi-tenant timesheet portal. Employees submit timesheets; admins
approve them. **This repo is Phase 1 — the foundation only:** authentication,
multi-tenant organizations, role-based access, profile/employee management, and
the design system.

> Not yet built (later phases): timesheet upload, CSV mapping, dashboards,
> charts, FX, CFO webhook. Clean, typed seams are left where these plug in.

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
| `admin` | Manage own org's employees, rates, approvals, settings (`/app/employees`, `/app/settings`) |
| `employee` | View own profile; submit timesheets (later phase) |

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
