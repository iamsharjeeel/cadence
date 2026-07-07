# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev         # local dev server (next dev)
npm run build       # production build (next build) — also the final CI gate
npm run typecheck   # tsc --noEmit (strict mode; load-bearing)
npm run lint        # next lint (eslint, next/core-web-vitals)
npm run start        # serve a production build
```

There is **no test runner and no test suite** in this repo. CI (`.github/workflows/ci.yml`, mirrored in `.gitlab-ci.yml`) is exactly `npm ci → typecheck → lint → build` on Node 20. Before pushing, run those three in that order — it is the whole contract.

Operational scripts (require real env + network; not part of CI):

```bash
npm run qa:prod     # node scripts/qa-prod-api-webhook.mjs — exercises prod API + webhook seam
npm run qa:db       # node scripts/live-db-audit.mjs — read-only live DB isolation audit
npm run sync:pull   # bash scripts/sync-from-cloud.sh
npm run sync:push   # bash scripts/sync-to-cloud.sh — pushes BOTH origin and gitlab remotes
```

To confirm which commit is live in production:
```bash
curl -s https://cadence-eta-five.vercel.app | grep -o 'data-build="[^"]*"'   # compare to git rev-parse origin/main
```

## Architecture

Cadence is a **multi-tenant SaaS timesheet / people-ops portal**: Next.js 14 (App Router, `src/` dir, TypeScript strict) on Supabase (Postgres + Auth via Google OAuth + Storage + RLS through `@supabase/ssr`). Deploy target Vercel; package manager npm. GitHub `iamsharjeeel/cadence` is the deploy source of truth; GitLab is a synced mirror.

### The three Supabase clients (get this right — it is the core security boundary)
All under `src/lib/supabase/`:
- **`client.ts`** — browser client, anon key only. Safe in Client Components. Honours RLS as the logged-in user.
- **`server.ts`** — server client, anon key + the caller's cookie session. Use in Server Components, Route Handlers, Server Actions. Honours RLS **as the authenticated user**. This is the default for anything reading/writing tenant data.
- **`admin.ts`** — service-role client, **bypasses RLS**. Guarded by `import "server-only"` (build fails if pulled into a client bundle). ONLY in Server Actions / Route Handlers, and you MUST re-check the caller's role server-side before any privileged write. Never reach for this to "make a query work" — that usually means you've defeated tenant isolation.

`src/middleware.ts` → `src/lib/supabase/middleware.ts` (`updateSession`) refreshes the session cookie on every non-static request and holds the route guards (suspended-user redirect, etc.).

### Workspace model — "personal-by-default + true multi-workspace" (Track C)
This is the concept that ties the whole app together; read `src/lib/workspace.ts` and `README.md`'s "Workspace model" section before touching data-scoped code.

- Every user is a **personal account** (solo product works with `org_id IS NULL`, no approval layer). Users can also belong to many orgs via a `memberships` table (`user_id, org_id, role ∈ owner/admin/employee`).
- The **active workspace** (server-side `active_workspace` table) decides "am I acting as personal, or as org X?". It drives both the UI *and* the DB scope. Switch only through the `set_active_workspace()` RPC on the authenticated server client.
- **`getWorkspaceContext()`** (`src/lib/workspace.ts`, React-`cache`d) is the source of truth. It returns `effectiveProfile` — `profile.org_id`/`role` re-pointed at the active workspace so legacy role/org-scoped code keeps working (superadmin → oversight/null; personal → admin-equivalent/null; org → membership role/that org).
- **Isolation is enforced in the database via RLS.** `auth_org()` in Postgres resolves the active workspace **validated against your memberships** — a forged/stale org claim resolves to personal (no access). The app layer must never be the only thing standing between a user and another tenant's data.
- **`src/lib/org-scope.ts`** (`trustOrgScope` / `trustRequiredOrgScope`) is the server-side gate that validates a requested `org_id` against the caller's real workspace context and throws on mismatch. Use it whenever an org id arrives from the client.

### API surfaces
- **`src/app/api/v1/*`** — public REST endpoints (`members`, `projects`, `time-entries`) authenticated by **Bearer API key** via `src/lib/api-auth.ts` (`validateApiKey`: SHA-hash lookup in `api_keys`, honours `revoked_at`/`expires_at`, `read_only|full` permission). These use the admin client, so scoping is entirely the handler's responsibility.
- **`src/app/api/cron/webhook-retries`** — scheduled every 15 min (`vercel.json`); gated by `CRON_SECRET`.
- OAuth callbacks (`asana`, `google-calendar`) and export/generate routes make up the rest of `src/app/api/`.

### `src/lib/` domain logic (server-side business rules live here, not in components)
Organized by domain: `time`, `timesheets`, `leave`, `reports`, `dashboard`, `documents/pdf`, `onboarding`, `org-documents`, `org-settings`, `webhooks` + `webhook-dispatcher.ts`, `asana`, `google-calendar`, `api-keys`, `audit`. Cross-cutting helpers at the `src/lib/` root: `validation.ts` (zod), `rate-limit.ts`, `resend.ts` (email), `audit.ts`, crypto (`bank-crypto.ts`, `asana-crypto.ts` — AES-256-GCM via `DOCUMENT_ENCRYPTION_KEY`).

### Data layer
`supabase/migrations/` — 24 timestamped SQL migrations; **RLS policies and the `auth_org()`/`create_organization()`/`accept_invite()`/`set_active_workspace()` RPCs live here**, so a schema or policy change is a migration, not an ad-hoc query. `supabase/seed/` bootstraps the superadmin; `supabase/scripts/` holds maintenance SQL. Generated DB types in `src/types/db`.

### Domain gotchas (each cost a prior debugging session — see README history)
- **Overnight duration** (e.g. 23:30→00:15 = 0.75h) is computed with a wrapping formula in app code, NOT read from the DB generated column (which goes negative for overnight). Don't "fix" it by trusting the column.
- **`is_overnight` is not a real column** — never include it in Supabase write payloads; overnight is derived client-side.
- **Modals and DatePicker popovers render via a portal to `document.body`** so `position: fixed` escapes the transformed page-transition ancestor. Keep new overlays on that pattern or they render off-center.
- **Rates/currency are snapshotted at approval time** on timesheets — don't recompute historical pay from current rates.

## Conventions
- Path alias `@/*` → `./src/*`.
- Server-only modules declare `import "server-only"` at the top — respect it; do not import them from Client Components.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `DOCUMENT_ENCRYPTION_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, Asana/Google OAuth) are documented by name in `.env.local.example`. Anything client-visible must be `NEXT_PUBLIC_`-prefixed; nothing else should be.

## Reference docs
- `README.md` — product spec, full feature history, workspace model (authoritative).
- `SECURITY_AUDIT.md` — prior security audit with tracked finding IDs (L1/L2/C1/C2/H1); consult before security-relevant changes.
- `HANDOVER.md` — large running session log (history/context; skim by search, don't read whole).
- `docs/AUDIT_REPORT.md` / `docs/THINKING_LOG.md` — findings and method from the automated hygiene pass.
