# CADENCE — Project Handover

A complete brief to continue this project in a fresh chat or Cursor session. Paste this in full.

---

## What we're building
**Cadence** — a premium, multi-tenant SaaS timesheet portal. Employees have profiles (info, rate, etc.) and upload timesheets (CSV / Excel / Google Sheets). The system parses, validates, stores them, and admins approve. Approved data will later be pushed to a "CFO Claude Agent" via webhook (deferred). Tagline: "Time, tracked with rhythm."

## Stack
- **Frontend/host:** Next.js 14 (App Router, TypeScript, `src/`) on Vercel
- **Backend:** Supabase (Postgres + Auth + Storage + RLS) via `@supabase/ssr`
- **Motion:** GSAP (Three.js dropped — premium feel achieved with CSS + GSAP)
- **Build agents:** Cursor Composer (primary going forward), Claude Code (used for Phases 1–2)
- **Package manager:** npm

## Live infra
- **Supabase project URL:** `https://irybkcryeywmwpcmhlaa.supabase.co` (region: Singapore)
- **Vercel URL:** `https://cadence-eta-five.vercel.app` (no custom domain yet)
- **GitHub repo:** `cadence` (private, `iamsharjeeel/cadence`)
- **Google OAuth:** configured — redirect URI `https://irybkcryeywmwpcmhlaa.supabase.co/auth/v1/callback`, JS origin `https://cadence-eta-five.vercel.app`
- **Supabase Auth URL config:** Site URL = Vercel URL; Redirect URLs include `https://cadence-eta-five.vercel.app/**`
- **Env vars (set in Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `SUPERADMIN_EMAIL` (server-only)

## Key product decisions (all locked)
- **Multi-tenant** from day one. Every table scoped by `org_id`.
- **Three roles:** `superadmin` (platform — creates orgs, sees all) / `admin` (manages own org) / `employee` (own data only).
- **Auth:** Google OAuth only. Domain-gated — user email domain matched against org `allowed_domains`.
- **Account creation:** admin invite + self-signup, both gated by admin approval. New users land `pending`.
- **Org creation:** superadmin creates orgs manually.
- **Rates:** admin sets/edits employee rate; employee views own rate read-only.
- **Rate types:** hourly (hours×rate), salaried (period slice, hours informational), fixed (flat, hours informational).
- **Pay periods:** configurable cadence (weekly/biweekly/monthly) per org + freeform custom ranges. Overlap guard prevents duplicate periods.
- **Approval workflow:** draft → submitted → approved/rejected (rejected→resubmit). Rate + currency snapshot onto timesheet AT APPROVAL.
- **Calc:** simple, server-side, for dashboards/at-a-glance only. Stored as `calculated_total`.
- **Currency/FX:** multi-currency labels stored; FX conversion DEFERRED. No cross-currency summing (dashboards group by currency).
- **CFO webhook:** DEFERRED. Dormant `webhook_deliveries` table + payload-builder function exists. Event-driven on approval, NOT cron.

## Design system — "Quiet luxury for data"
- **Theme:** light-default + dark mode. Reference: Linear × Mercury × Vercel.
- **Accent:** Mineral Teal `#1F8A8A` (soft `rgba(31,138,138,0.12)`, strong `#157070`). Dark mode: `#2AA6A6`.
- **Light tokens:** bg `#FBFBF9`, surface `#FFFFFF`, ink `#14151A`, muted `#6B6F76`, line `rgba(20,21,26,0.08)`, radius 16px.
- **Dark tokens:** bg `#0E0F12`, surface `#16181D`, ink `#EDEDEA`, hairline borders low-opacity white.
- **Type:** Space Grotesk for headings + ALL numbers (`tabular-nums`); Inter for body/UI.
- **Motion (GSAP):** fade+rise route transitions (~300ms power2.out), staggered list reveals, number count-ups, subtle button lift. Respect `prefers-reduced-motion`.
- **Charts:** `recharts`. Teal `#1F8A8A` primary series, muted `#6B6F76` secondary. Dark mode: `#2AA6A6`.
- **Cards:** surface bg, 1px hairline border, 16–18px radius, soft diffuse shadow only.

## Database schema (all live in Supabase)

### Enums
- `user_role`: superadmin | admin | employee
- `user_status`: pending | active | suspended
- `rate_type`: hourly | salaried | fixed
- `period_cadence`: weekly | biweekly | monthly

### Tables
- `organizations`: id, name, slug, base_currency, allowed_domains[], default_cadence, logo_url, created_at
- `profiles`: id=auth.users.id, org_id, full_name, email, role, status, rate, rate_type, currency, created_at
- `audit_log`: id, org_id, actor_id, action, entity, payload jsonb, created_at
- `timesheets`: id, org_id, employee_id, period_start, period_end, status (draft|submitted|approved|rejected), raw_file_path, rejection_note, approved_at, approved_by, rate_snapshot, rate_type_snapshot, currency_snapshot, calculated_total, created_at, updated_at
- `timesheet_rows`: id, timesheet_id, org_id, row_date, hours, project, description, billable, created_at
- `webhook_deliveries`: id, org_id, timesheet_id, payload jsonb, status (pending|delivered|failed), attempts, last_attempted_at, delivered_at, created_at

### Helper functions (SECURITY DEFINER)
`auth_role()`, `auth_org()`, `is_active()`

### Trigger
`on_auth_user_created` — auto-creates a pending profile on signup

### Storage
Private bucket: `timesheets`. Paths: `timesheets/{org_id}/{employee_id}/{timesheet_id}/raw`. Signed URLs only (1hr expiry).

## Security requirements (non-negotiable)
- Org-scoped RLS on every table + Storage bucket.
- Private storage bucket, signed URLs only.
- Server-side re-validation of all parsed rows (never trust client).
- Service-role key server-only, never `NEXT_PUBLIC_`, never in client bundle.
- Rate/calc always from DB server-side, never client input.
- Employees can never self-set role/rate/status — enforced in server actions.
- Audit log on: approval, role/rate/status change, org creation, timesheet submission.
- Reject `.xlsm`/macros; validate MIME + extension + size (max 10MB).
- CSV export: re-check admin/superadmin role server-side before streaming.
- Never expose unapproved timesheets in export.

## Cost note
No hourly crons (paid). Daily crons only (free). Currently using none.

## What is built (Phases 1 + 2 complete)

### Phase 1 ✅
- Full Next.js 14 App Router scaffold, TypeScript, `src/` layout.
- Supabase clients: browser, server (RSC/actions), admin (service-role, `server-only` guarded), middleware session refresh.
- `/auth/callback` with domain-gating and `SUPERADMIN_EMAIL` backstop.
- Role-aware nav + screens: dashboard, profile, employees (admin + superadmin), organizations (superadmin), settings (admin).
- Superadmin sees all employees across all orgs with org column; admin sees own org only.
- `authorizeTarget`: superadmin can mutate any non-superadmin profile in any org; admin only within their `org_id`.
- Audit log on approve, role/rate/status change, org create/update.
- Design system: CSS-variable tokens, Space Grotesk + Inter, light/dark (`next-themes`), GSAP transitions + `Reveal` + `CountUp`.
- Primitives: Button, Card, Input, Select, Badge, Table, Avatar, EmptyState, Toast.

### Phase 2 ✅
- Three upload methods funneling into one pipeline: parse → header map → preview/validate → submit.
  1. Drag/drop file picker (CSV/XLSX, 10MB, MIME+ext validated, PapaParse + SheetJS)
  2. Clipboard paste (⌘/Ctrl+V, TSV parsed instantly)
  3. Google Sheets public link (server-side fetch via `/api/google-sheet`, no OAuth)
- Header mapping: fuzzy auto-match, persists per org slug in localStorage, only prompts for unmatched columns.
- Canonical fields: `date` (required), `hours` (required), `project`, `description`, `billable`, `start_time` (passthrough), `end_time` (passthrough).
- Aliases: `TOTAL HOURS` / `totalhrs` / `hours worked` → `hours`; `START TIME` → `start_time`; `END TIME` → `end_time`.
- Auto-skip metadata rows heuristic (mode-of-widths); user-overridable "skip top rows" input.
- Row transformations: summary-row exclusion, forward-fill blank date/day cells, skip zero-hour rows toggle.
- Period anchor: resolves weekday names against selected period start.
- Live validation preview: red-highlighted invalid rows, deletable, GSAP count-up summary, submit blocked while errors remain.
- Submit: server-side row re-validation, period overlap guard, raw file → Supabase Storage, insert timesheet + rows, audit `timesheet_submitted`.
- Timesheet list (`/app/timesheets`): role-aware (employee own / admin org / superadmin all), status + employee filters, inline approve/reject.
- Approval: snapshots rate/rate_type/currency from DB, computes `calculated_total` server-side, sets approved_at/approved_by, inserts dormant `webhook_deliveries` row, audits `timesheet_approved`.
- Detail page: read-only rows, rejection note, approval summary, 1hr signed-URL raw download.

## Known issue to fix
**Upload wizard column mapping bug:** fuzzy matcher is misfiring — all columns map to `Date`. Fix needed:
- Stricter scoring threshold; unconfident matches → "unmatched, user must pick" rather than wrong confident guess.
- Real-world timesheet format to design around (most uploads will match this):
  - Rows 1–6: metadata (logo, name, pay period) — auto-skip
  - Row 7: `DAY | DATE | START TIME | END TIME | TOTAL HOURS`
  - Row 8+: data rows; blank DAY/DATE cells forward-fill from above
  - Zero-hour rows skippable; summary row ("Total Weekday hours = 67") auto-excluded.

## Phase 3 — TO BUILD NEXT

### Upload wizard fix (do this first — see Known issue above)

### Timesheet list improvements
- Add `calculated_total` + currency column, sortable.
- Bulk approve (checkbox + approve all selected).
- Filter by: status, employee, date range, org (superadmin only).
- Rejected timesheets show rejection note inline.

### Admin dashboard (replace Phase 1 placeholder at `/app/dashboard`)

**Employee view:**
- Approved hours this month, total earnings (grouped by currency — no cross-currency summing).
- Recent timesheets list (last 5), status badges, click to detail.
- "Submit new timesheet" CTA.

**Admin view:**
- Pending approvals count (badge + quick-link to submitted filter).
- Team summary: total approved hours this period, payroll estimate grouped by currency.
- Employee breakdown table: name, role, rate, approved hours this period, estimated total.
- Recent activity feed (last 10 audit log entries for org).

**Superadmin view:**
- Org-level summary cards: org name, employee count, pending approvals, total approved hours.
- Click org card → drill into that org's admin view.

### Charts (recharts)
- Admin: bar chart approved hours per employee this period; line chart weekly approved hours trend (last 8 weeks).
- Employee: line chart approved hours per period (last 6 periods).
- GSAP count-up on summary numbers. Respect `prefers-reduced-motion`.

### CSV export
- Admin/superadmin only. Approved timesheets for selected date range.
- Columns: employee name, email, role, rate, rate type, currency, period start, period end, total hours, calculated total, approved at, approved by.
- Server-side route handler, streamed as file download. Never expose unapproved timesheets.

### Approval flow polish
- Approve/reject from detail page (not just list).
- Reject modal: required note, confirm button.
- On approve: animated success, `calculated_total` displayed immediately.
- On reject: status flips, rejection note shown to employee.

## Deferred (do not build yet)
- FX conversion layer (cross-currency summing)
- CFO Claude Agent webhook activation (seam exists, just dormant)
- Public marketing landing page

## Working preferences
- Direct, snappy, concise. Minimal preamble.
- For each build phase: manual actions FIRST (numbered), then the agent prompt.
- Spell out env vars relative to Vercel + Supabase; give SQL explicitly.
- When producing specs/prompts/SQL — no direct code unless asked.
- Don't mention brand/agency names in outputs unless brought up.
