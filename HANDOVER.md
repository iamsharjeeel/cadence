# Handover

A complete brief to continue this project in a fresh chat or Cursor session.

---

## Agent workflow

| Role | Model | Responsibility |
|------|-------|----------------|
| **Planner / overseer** | Fable | Scope, architecture, audit interpretation, doc structure, review Composer output |
| **Executor** | Composer 2.5 | npm install, env setup, typecheck/lint/build, file edits, Supabase queries, debugging |

Fable plans and oversees; Composer 2.5 writes, debugs, audits, and runs heavy execution.

---

## Current state (2026-07-06)

- **Git:** `main` @ `b3467dc` (synced to origin; Menu A+B+C + docs)
- **Env:** `CRON_SECRET` set in Vercel Production; add to Preview if you use preview cron
- **Local path:** `c:\Users\Zima\Desktop\apps\cadence\cadence`
- **Live:** [cadence-eta-five.vercel.app](https://cadence-eta-five.vercel.app) · Supabase `irybkcryeywmwpcmhlaa` (MCP connected)
- **Model:** Personal-by-default + multi-workspace (Track C live since 2026-06-15). Invite-only org join; self-serve `create_organization`.
- **Build:** `npm run typecheck`, `lint`, `build` — all pass (pre-existing `<img>` lint warnings only)
- **Env:** `.env.local` via `vercel link` + `vercel env pull`; `CRON_SECRET` in Vercel + `.env.local.example`
- **QA (prod):** `npm run qa:prod` — **9/9 pass** post-deploy (2026-07-06)
- **Verification:** `npm run typecheck && npm run lint && npm run build`

### Quick reference

- **Product/features:** [README.md](README.md)
- **Security findings:** [SECURITY_AUDIT.md](SECURITY_AUDIT.md) — L1/L2 fixed in code+live migration; audit doc not yet re-verified
- **Local sync:** `scripts/sync-from-cloud.sh` / `sync-to-cloud.sh` (bash; on Windows use Git Bash or manual git)
- **Verify live deploy:** `curl -s https://cadence-eta-five.vercel.app | grep data-build` vs `git rev-parse origin/main`

### Security status (summary)

- **C1/C2/H1/M1/M2/Track C/F4:** FIXED — live MCP exploit battery passed (2026-07-06)
- **L1/L2:** FIXED — `menu_abc_features` migration + `trustOrgScope`; noted in SECURITY_AUDIT.md
- **W1:** `webhook_deliveries.timesheet_id` nullable — applied live + in repo migration
- **Supabase MCP:** Connected to Cadence org `irybkcryeywmwpcmhlaa`

### Open items / pending

- Preview OAuth redirects to production URL (infra — needs owner sign-off)
- Live vs repo migration naming drift (functionally aligned; MCP names differ from repo filenames)
- Optional: add `CRON_SECRET` to Preview env if preview cron matters

### Shipped this session (Menu A+B+C)

- **Timer entry approval:** manager queue on `/app/time-tracked`, approve/reject/bulk, notifications, `approver_scope` enforced
- **Expenses MVP:** `/app/expenses`, submit + admin approve/reject, `approvals_expenses` toggle wired
- **Webhooks:** inline retries (3x), manual retry in UI, cron `/api/cron/webhook-retries` every 15m
- **API v1:** 120 req/min rate limit, `read_only` vs `full` key permission
- **L1/L2:** anon INSERT/UPDATE/DELETE revoked; service-role aggregators use `trustOrgScope`
- **CI:** `.github/workflows/ci.yml` (typecheck, lint, build)

### Next chat — read first

1. This **Current state** section
2. [SECURITY_AUDIT.md](SECURITY_AUDIT.md) — 2026-07-06 re-verification block
3. [CHANGELOG.md](CHANGELOG.md) — 2026-07-06 entry

---

## Session log

## What we're building
**Cadence** — a premium, multi-tenant SaaS timesheet portal. Employees log time in-app (start/end, project, description, billable); admins approve period timesheets. Approved data will later be pushed to a "CFO Claude Agent" via webhook (deferred). Tagline: "Time, tracked with rhythm."

## Stack
- **Frontend/host:** Next.js 14 (App Router, TypeScript, `src/`) on Vercel
- **Backend:** Supabase (Postgres + Auth + Storage + RLS) via `@supabase/ssr`
- **Motion:** GSAP (Three.js dropped — premium feel achieved with CSS + GSAP)
- **Charts:** `recharts`. Gold via `--accent-rgb` / `useChartColors()` — primary series Warm Gold, muted `#6B6F76` secondary.
- **Build agents:** Cursor Composer (primary going forward), Claude Code (used for Phases 1–2)
- **Package manager:** npm

## Live infra
- **Supabase project URL:** `https://irybkcryeywmwpcmhlaa.supabase.co` (region: Singapore)
- **Vercel URL:** `https://cadence-eta-five.vercel.app` (no custom domain yet)
- **GitHub repo:** `cadence` (private, `iamsharjeeel/cadence`)
- **Local clone:** `~/Desktop/cadence` — keep in sync with cloud via `scripts/sync-from-cloud.sh` (pull) and `scripts/sync-to-cloud.sh` (push). See README **Local ↔ cloud sync**.
- **Google OAuth:** configured — redirect URI `https://irybkcryeywmwpcmhlaa.supabase.co/auth/v1/callback`, JS origin `https://cadence-eta-five.vercel.app`
- **Supabase Auth URL config:** Site URL = Vercel URL; Redirect URLs include `https://cadence-eta-five.vercel.app/**`
- **Env vars (set in Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `SUPERADMIN_EMAIL` (server-only), `DOCUMENT_ENCRYPTION_KEY` (server-only), `RESEND_API_KEY` (server-only), `RESEND_FROM_EMAIL` (server-only), `ASANA_CLIENT_ID` (server-only), `ASANA_CLIENT_SECRET` (server-only), `ASANA_REDIRECT_URI` (server-only — `https://cadence-eta-five.vercel.app/api/asana/callback`), `GOOGLE_CLIENT_ID` (server-only), `GOOGLE_CLIENT_SECRET` (server-only), `GOOGLE_CALENDAR_REDIRECT_URI` (server-only — `https://cadence-eta-five.vercel.app/api/google-calendar/callback`)

## Key product decisions (all locked)

> **Superseded (2026-07-06):** Domain-gated auto-join and superadmin-only org creation below were replaced by Track C — invite-only join + self-serve `create_organization`. See **Current state** above and README **Workspace model**.

- **Multi-tenant** from day one. Every table scoped by `org_id`.
- **Three roles:** `superadmin` (platform — creates orgs, sees all) / `owner` (org owner) / `admin` (manager — manages own org) / `employee` (own data only). UI shows `admin` as “Manager”.
- **Auth:** Google OAuth only. Domain-gated — user email domain matched against org `allowed_domains`.
- **Account creation:** admin invite (email link) or self-signup via matching org domain. New users land **active** — no pending approval gate. Invite redemption assigns org + role on first OAuth sign-in.
- **Org creation:** superadmin creates orgs manually.
- **Rates:** employee sets/edits own rate on Profile; admin/owner can also edit via Team table. Rate history/versioning at submission time remains a future consideration.
- **Rate types:** hourly (hours×rate), salaried (period slice, hours informational), fixed (flat, hours informational).
- **Pay periods:** configurable cadence (weekly/biweekly/monthly) per org + freeform custom ranges. Overlap guard prevents duplicate periods.
- **Approval workflow:** draft → submitted → approved/rejected (rejected→resubmit). Rate + currency snapshot onto timesheet AT APPROVAL.
- **Calc:** simple, server-side, for dashboards/at-a-glance only. Stored as `calculated_total`.
- **Currency/FX:** multi-currency labels stored; FX conversion DEFERRED. No cross-currency summing (dashboards group by currency).
- **CFO webhook:** DEFERRED. Dormant `webhook_deliveries` table + payload-builder function exists. Event-driven on approval, NOT cron.

## Design system — "Quiet luxury for data"
- **Theme:** light-default + dark mode. Reference: Linear × Mercury × Vercel.
- **Accent:** Warm Gold `#B8862F` (soft `rgba(184,134,47,0.12)`, strong/hover `#A0751F`). Dark mode: `#C9973F`.
- **Light tokens:** bg `#FBFBF9`, surface `#FFFFFF`, ink `#14151A`, muted `#6B6F76`, line `rgba(20,21,26,0.08)`, radius 16px.
- **Dark tokens:** bg `#000000` (true black), surface `#0D0D0D`, ink `#EDEDEA`, muted `#6B6F76`, line `rgba(237,237,234,0.08)`.
- **CSS vars:** `--accent`, `--accent-soft`, `--accent-strong` (= hover), `--accent-rgb` (for rgba chart fills); dark overrides in `.dark`.
- **Type:** Space Grotesk for headings + ALL numbers (`tabular-nums`); Inter for body/UI.
- **Motion:** Framer Motion in app shell; GSAP for landing hero only.
- **Charts:** `recharts`. Gold `#B8862F` primary series, muted `#6B6F76` secondary. Dark mode: `#C9973F`.
- **Cards:** surface bg, 1px hairline border, 16–18px radius, soft diffuse shadow only.

## Database schema (all live in Supabase)

### Enums
- `user_role`: superadmin | owner | admin | employee
- `user_status`: pending | active | suspended
- `rate_type`: hourly | salaried | fixed
- `period_cadence`: weekly | biweekly | monthly

### Tables
- `organizations`: id, name, slug, base_currency, allowed_domains[], default_cadence, logo_url, created_at
- `profiles`: id=auth.users.id, org_id, full_name, email, role, status, rate, rate_type, currency, bank_name, bank_account_name, bank_account_number (encrypted), bank_bsb_swift (encrypted), tax_id, address, payment_terms_days, created_at
- `audit_log`: id, org_id, actor_id, action, entity, payload jsonb, created_at
- `timesheets`: id, org_id, employee_id, period_start, period_end, status (draft|submitted|approved|rejected), has_overtime, overtime_hours, raw_file_path (legacy upload path), rejection_note, approved_at, approved_by, rate_snapshot, rate_type_snapshot, currency_snapshot, calculated_total, created_at, updated_at
- `timesheet_rows`: id, timesheet_id, org_id, row_date, hours, project, description, billable, created_at — **legacy** (pre–Phase 7 uploads); kept for historical rows
- `projects`: id, org_id, owner_id, name, color, is_org_wide, is_active, created_at — org-wide or personal projects for time entry
- `time_entries`: id, org_id, employee_id, timesheet_id, project_id, asana_project_id (FK → asana_imported_projects), entry_date, start_time, end_time, entry_mode (`time_range`|`decimal_hours`), decimal_hours, is_overnight, total_hours (generated column — never written from client), description, billable, created_at, updated_at — in-app time logging (replaces upload flow)
- `webhook_deliveries`: id, org_id, timesheet_id, payload jsonb, status (pending|delivered|failed), attempts, last_attempted_at, delivered_at, created_at
- `documents`: id, org_id, timesheet_id, employee_id, type (pay_advice|invoice), status (draft|in_progress|verified|corrections_needed), document_number, gst_enabled, gst_rate, subtotal, gst_amount, total, currency, file_path, emailed_at, generated_by, status_changed_by, status_changed_at, created_at, updated_at
- `org_invites`: id, org_id, email, role, invited_by, created_at, expires_at, accepted_at — pending email invites
- `asana_connections`: id, user_id (unique), access_token_enc, refresh_token_enc, expires_at, asana_user_gid/name/email, project_names_synced_at, connected_at, updated_at — per-user OAuth tokens (encrypted)
- `asana_imported_projects`: id, user_id, asana_project_gid, asana_project_name, asana_workspace_gid/name, imported_at — personal imported project list (not org `projects`)
- `google_calendar_connections`: id, user_id (unique), access_token_enc, refresh_token_enc, expires_at, google_email, connected_at, updated_at — per-user Google OAuth tokens (encrypted)
- `google_selected_calendars`: id, user_id, calendar_id, calendar_name, is_synced — calendars chosen for sync
- `google_calendar_events`: id, user_id, google_event_id, calendar_id, title, description, location, start_at, end_at, organizer_email/name, guests jsonb, html_link, synced_at — persisted synced events

### Helper functions (SECURITY DEFINER)
`auth_role()`, `auth_org()`, `is_active()`, `next_document_number(org_id, type)`

### Trigger
`on_auth_user_created` — auto-creates a pending profile on signup

### Storage
- Private bucket: `timesheets`. Paths: `{org_id}/{employee_id}/{timesheet_id}/raw`. Signed URLs only (1hr expiry).
- Private bucket: `documents`. Paths: `{org_id}/{employee_id}/{document_id}.pdf`. Signed URLs only (1hr expiry).

**Apply Phase 4 migration:** run `supabase/migrations/20260611000000_phase4_documents.sql` in Supabase SQL editor (or `supabase db push`).

## Security requirements (non-negotiable)
- Org-scoped RLS on every table + Storage bucket.
- Private storage bucket, signed URLs only.
- Server-side re-validation of all parsed rows (never trust client).
- Service-role key server-only, never `NEXT_PUBLIC_`, never in client bundle.
- Rate/calc always from DB server-side, never client input.
- Employees can never self-set role/status (nor org_id) — enforced in server actions **and** at the DB layer (column grants + trigger; see Security remediation log → C1). Rate is self-editable on Profile.
- Audit log on: approval, role/rate/status change, org creation, timesheet submission.
- Reject `.xlsm`/macros; validate MIME + extension + size (max 10MB).
- CSV export: re-check admin/superadmin role server-side before streaming.
- Never expose unapproved timesheets in export.
- Dashboard aggregates: admin queries always filter by `profile.org_id`; superadmin org drill-down validates org server-side (never trust client `org_id` for admin scope).

### Security remediation log
- **2026-06-14 — C1 / C2 / H1 from `SECURITY_AUDIT.md` FIXED at the DB/storage-policy layer** (live project `irybkcryeywmwpcmhlaa`; applied via Supabase MCP `apply_migration` and committed as migration files):
  - **C1** (profiles privilege-escalation) — `supabase/migrations/20260625000000_c1_profiles_block_self_role_status_org_escalation.sql`. `authenticated`'s table-wide UPDATE on `profiles` was reset to per-column UPDATE **excluding** `role`/`status`/`org_id`, plus a SECURITY DEFINER `BEFORE UPDATE` trigger (`guard_profiles_privileged_columns`) that rejects changes to those columns unless the session is service-role / a direct DB connection. The admin path (every such write goes through `createAdminClient` = service role) and employee self-edit of profile basics are both unaffected.
  - **C2 + H1** (timesheets bucket readable/writable by any authenticated user) — `supabase/migrations/20260626000000_c2_h1_drop_legacy_timesheets_storage_policies.sql`. Dropped the loose legacy `ts_read`/`ts_upload` storage policies; the correctly org/path-scoped `timesheets_storage_select` / `timesheets_storage_insert` remain.
  - **Verified live (exploits re-run as a real `authenticated` session, all rolled back):** self `role`/`status`/`org_id` updates rejected with `42501` while legit profile-basics edits still succeed; an Org A employee can neither read nor write Org B's timesheet files, while own-org access still works. Production currently holds **2 orgs**, so C2/H1 was a *live* cross-tenant exposure, not just latent.
  - **Superseded (2026-07-06):** M1/M2 were CLOSED by Track C2 (`20260628000000_track_c2_atomic_cutover_rls_rewrite.sql`). **L1/L2** remain open. See SECURITY_AUDIT.md.

## Cost note
No hourly crons (paid). Daily crons only (free). Currently using none.

## What is built (Phases 1 + 2 + 3 complete)

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
- Auto-skip metadata rows heuristic (mode-of-widths + payroll header signature); user-overridable "skip top rows" input.
- Row transformations: summary-row exclusion, forward-fill blank date/day cells, skip zero-hour rows toggle.
- Period anchor: resolves weekday names against selected period start.
- Live validation preview: red-highlighted invalid rows, deletable, GSAP count-up summary, submit blocked while errors remain.
- Submit: server-side row re-validation, period overlap guard, raw file → Supabase Storage, insert timesheet + rows, audit `timesheet_submitted`.
- Timesheet list (`/app/timesheets`): role-aware (employee own / admin org / superadmin all), status + employee filters, inline approve/reject.
- Approval: snapshots rate/rate_type/currency from DB, computes `calculated_total` server-side, sets approved_at/approved_by, inserts dormant `webhook_deliveries` row, audits `timesheet_approved`.
- Detail page: read-only rows, rejection note, approval summary, 1hr signed-URL raw download.

### Phase 3 ✅

#### Upload wizard fix
- **Stricter fuzzy matcher** (`src/lib/timesheets/columns.ts`): minimum score 2 (exact or prefix match only); score-1 substring matches removed. Unconfident columns stay unmatched for manual pick.
- **DATE vs DAY:** when both headers exist, `DATE` column wins for the date field; `day` alias only used as fallback.
- **Aliases updated:** `TOTAL HOURS` / `totalhrs` / `hours worked` → hours; `DATE` / `work date` → date; `START TIME` / `start` → start_time; `END TIME` / `end` → end_time.
- **Payroll format detection** (`src/lib/timesheets/parse.ts`): auto-detects `DAY | DATE | START TIME | END TIME | TOTAL HOURS` header row (typically row 7 after 6 metadata rows).

#### Timesheet list improvements (`/app/timesheets`)
- `calculated_total` + currency column for admin/superadmin, sortable.
- Bulk approve: checkbox select + "Approve selected" (one audit entry per timesheet).
- Filters: status, employee, date range (`from`/`to`), org (superadmin only).
- Rejected timesheets show rejection note inline.
- CSV export button (admin/superadmin) with date range picker.

#### Admin dashboard (`/app/dashboard`)
**Employee view:**
- Approved hours this month + total earnings grouped by currency (no cross-currency summing).
- Recent timesheets (last 5) with status badges, linked to detail.
- Line chart: approved hours per period (last 6 periods).
- "Log time" CTA → `/app/timesheets`.

**Admin view:**
- Pending approvals count with badge + quick-link to submitted filter.
- Team summary: approved hours + payroll estimate grouped by currency.
- Employee breakdown table: name, role, rate, approved hours, estimated total.
- Recent activity feed (last 10 audit log entries).
- Bar chart: approved hours per employee; line chart: weekly trend (last 8 weeks).

**Superadmin view:**
- Org-level summary cards: name, employee count, pending approvals, approved hours.
- Click org card → dedicated org drill-down at `/app/orgs/[slug]/dashboard` (full admin view scoped to that org).
- Legacy `?org=<uuid>` links redirect to the slug route.
- Organizations tab (`/app/organizations`): each org row is clickable → same drill-down route.

#### CSV export (`GET /api/timesheets/export`)
- Admin/superadmin only; role re-checked server-side.
- Approved timesheets only for selected date range.
- Columns: employee name, email, role, rate, rate type, currency, period start/end, total hours, calculated total, approved at/by.
- Streamed as file download.

#### Approval flow polish
- Approve/reject from detail page (`ApprovalControls.tsx`).
- Reject modal with required note + confirm.
- On approve: GSAP animated success state with `calculated_total` displayed immediately.
- On reject: status flips, rejection note shown to employee on detail view.

#### New / key files
- `src/lib/timesheets/columns.ts` — fixed auto-matcher
- `src/lib/timesheets/parse.ts` — payroll header detection
- `src/lib/dashboard/queries.ts` — server-side dashboard aggregates
- `src/lib/dashboard/period.ts` — month/week helpers
- `src/app/app/dashboard/` — dashboard page, charts, stat cards
- `src/app/app/timesheets/TimesheetListTable.tsx` — bulk select + sortable table
- `src/app/app/timesheets/ExportButton.tsx` — CSV export UI
- `src/app/app/timesheets/[id]/ApprovalControls.tsx` — detail-page approval
- `src/app/api/timesheets/export/route.ts` — CSV stream handler
- `bulkApproveTimesheets` in `src/app/app/timesheets/actions.ts`

### Phase 3 fixes + enhancements ✅

#### Click responsiveness (initial pass — superseded by Phase 4 fixes session)
- First attempt used `pointer-events: none` on animated shells during tweens.
- **Superseded:** see "Phase 4 fixes + landing page" — animate-once guards + no revert after complete.

#### Start / end time in upload wizard
- Preview table shows **Start** and **End** columns when mapped.
- **Hours resolution** (`resolveRowHours` in `validation.ts`): start/end → calculated hours takes precedence; falls back to TOTAL HOURS column. Overnight shifts handled (end < start → +24h).
- Preview shows **calc** vs **manual** badge on the hours cell.
- Server submit re-validates with the same `resolveRowHours` logic — never trusts client hours.

#### Superadmin org drill-down
- New route: `/app/orgs/[slug]/dashboard` — full admin dashboard (pending count, team summary, employee breakdown, activity feed, charts) scoped to that org.
- Breadcrumb: "All organizations / {org name}" with back link.
- Superadmin overview cards + Organizations table rows navigate to this route.
- Shared UI: `AdminDashboardView.tsx`.

#### New / updated files (fixes session)
- `src/lib/motion.ts` — pointer-event helpers, `REVEAL_ITEM_CLASS`
- `src/components/motion/Reveal.tsx`, `PageTransition.tsx` — click fix
- `src/lib/timesheets/validation.ts` — `parseTimeMinutes`, `hoursFromStartEnd`, `resolveRowHours`
- `src/app/app/dashboard/AdminDashboardView.tsx` — shared admin dashboard
- `src/app/app/orgs/[slug]/dashboard/page.tsx` — org drill-down
- `src/app/app/organizations/OrgTableRow.tsx` — clickable org rows

### Phase 4 ✅ — Document generation (Pay Advice + Contractor Invoice)

#### Database
- Profile banking columns: `bank_name`, `bank_account_name`, `bank_account_number`, `bank_bsb_swift`, `tax_id`, `address`, `payment_terms_days` (default 14).
- `documents` table with RLS + `next_document_number()` function.
- `documents` storage bucket with org-scoped policies.

#### Profile — banking & tax (`/app/profile`)
- Employee-editable Banking & Tax section.
- Account number + BSB/SWIFT encrypted at rest (`DOCUMENT_ENCRYPTION_KEY`, AES-256-GCM).
- Client sees masked values only (last 4 digits).

#### Employees — admin banking edit
- Admins edit employee banking via **Banking** button on team table (`/app/employees`).

#### Document generation flow
- Entry points: timesheet detail **Generate document**, timesheet list per-row + bulk select on approved timesheets.
- Modal: type (Pay Advice / Invoice), GST toggle + rate, preview summary, **Generate & send**.
- Server route: `POST /api/documents/generate` — role re-validated; employee own approved only; admin org-scoped; superadmin unrestricted.
- PDF via `@react-pdf/renderer` (serverless-safe, no headless browser).
- Storage upload + `documents` row + Resend email with PDF attachment + `emailed_at`.
- Audit: `document_generated`, `document_emailed`, `document_status_changed`.

#### Documents list (`/app/documents` — all roles in nav)
- Employee: own documents, status badge (read-only), download (signed URL), re-send email.
- Admin/superadmin: org/all orgs list, employee column, status dropdown, filters (type, status, employee, date range).

#### Env vars (Vercel, server-only unless noted)
- `DOCUMENT_ENCRYPTION_KEY` — 16+ char secret for bank field encryption.
- `RESEND_API_KEY` — Resend API key.
- `RESEND_FROM_EMAIL` — e.g. `hello@cadencemail.s1mplesolutions.cc`

#### Key files
- `supabase/migrations/20260611000000_phase4_documents.sql`
- `src/lib/bank-crypto.ts`, `src/lib/banking.ts`
- `src/lib/documents/generate.tsx`, `src/lib/documents/pdf/*`
- `src/app/api/documents/generate/route.ts`
- `src/app/app/documents/`
- `src/components/documents/GenerateDocumentModal.tsx`

### Phase 4 fixes + landing page ✅

#### Click responsiveness (proper fix)
- **Root cause:** `Reveal` and `PageTransition` re-ran GSAP entrance tweens on re-renders / `router.refresh()`, and `ctx.revert()` on cleanup briefly reset opacity / pointer state.
- **Fix:** `useRef` / pathname guard so each reveal animates **once**; `onComplete` explicitly sets `pointerEvents: "auto"` on every animated target; completed animations call `ctx.kill()` instead of `ctx.revert()`.
- `PageTransition` skips replay when pathname unchanged (e.g. after refresh).
- Removed `disablePointerEventsDuringAnim` — no longer blocking clicks during tweens.

#### Document generation fix
- **`getApprovedTimesheetsWithoutDocuments`** (`src/lib/documents/queries.ts`): queries `status = 'approved'`, org-scoped for admin, all orgs for superadmin, excludes timesheets that already have a `documents` row.
- **Documents page** "Generate from timesheets" opens a modal listing eligible timesheets with checkboxes + bulk select → `GenerateDocumentModal`.
- **API payload:** single generate sends `timesheet_id`; bulk sends `timesheet_ids` — `POST /api/documents/generate` unchanged, org derived server-side from timesheet.
- **Timesheet list:** approve/reject controls hidden when `status !== 'submitted'`; bulk "Approve selected" only shown when submitted rows are selected.

#### Public landing page (`/`)
- Full quiet-luxury marketing page outside `/app` layout: Hero, Features (3 cards), How it works (3 steps), testimonial placeholder, CTA banner, footer.
- Space Grotesk + Inter, Mineral Teal accent, light/dark via existing tokens.
- GSAP fade+rise on hero load only (once, no replay).
- CTAs → `/login`. Logged-in active users hitting `/` redirect to `/app/dashboard` (page + middleware).

#### New / updated files (this session)
- `src/components/motion/Reveal.tsx`, `PageTransition.tsx` — animate-once fix
- `src/lib/motion.ts` — removed pointer-events-during-anim helper
- `src/lib/documents/queries.ts` — approved timesheets without documents
- `src/components/documents/GenerateFromTimesheetsButton.tsx` — documents page modal
- `src/components/marketing/LandingPage.tsx` — full landing UI
- `src/app/(marketing)/page.tsx` — auth-aware home route
- `src/components/ui/Button.tsx` — exported `buttonStyles()` for Link CTAs
- `src/lib/supabase/middleware.ts` — active users on `/` → dashboard

### Carry-over fixes (post Phase 4) ✅

#### Click responsiveness — CSS only in app shell
- **Removed** GSAP `Reveal` and `PageTransition` from the app entirely (deleted).
- Interactive UI (buttons, cards, nav, tables, modals) has **no motion wrappers**.
- `FadeUp` / `FadeUpStagger` (`src/components/motion/FadeUp.tsx`) — CSS `@keyframes fadeUp` with `animation-fill-mode: forwards`, armed once via `useRef`. For decorative non-interactive use only.
- GSAP retained for: landing hero, `CountUp`, chart animations, onboarding complete screen.

#### Document generation — superadmin fix
- `getApprovedTimesheetsWithoutDocuments(profile, orgId?)` uses `createAdminClient()` — no `auth_org()` filter for superadmin; optional `orgId` param + org dropdown on documents page.
- `POST /api/documents/generate` logs failures with `console.error` for Vercel log visibility.

#### Landing — Three.js hero
- `HeroCanvas` lazy-loaded via `next/dynamic` (`ssr: false`) on landing hero only.
- Teal particle field (`#1F8A8A` / `#2AA6A6` dark), mouse parallax, fades on scroll past hero.
- `prefers-reduced-motion`: animation frozen, static frame kept.

### Phase 5 ✅ — Leave, Onboarding, Document Hub

#### Database (`supabase/migrations/20260612000000_phase5_leave_onboarding_docs.sql`)
- Tables: `leave_types`, `leave_balances`, `leave_requests`, `onboarding_steps`, `official_documents`
- Profile columns: `job_title`, `start_date`, `emergency_*`, `onboarding_complete`
- RLS policies per spec; `approve_leave_request` / `reject_leave_request` RPCs (atomic balance updates)
- Storage bucket: `official-documents`

#### Leave management (`/app/leave`)
- **Employee:** balance cards (CountUp), calendar month view, request modal (weekday calc, balance check), history + cancel pending.
- **Admin:** pending queue (approve/reject with note), team balance table.
- **Settings → Leave types tab:** view types, add custom, "Apply default to all employees".
- Default types seeded on org creation (`seedLeaveTypesForOrg`).
- Timesheet detail shows approved leave days notice (informational).
- Audit: `leave_requested`, `leave_approved`, `leave_rejected`, `leave_cancelled`.

#### Employee onboarding (`/app/onboarding`)
- Middleware redirects active employees with `onboarding_complete = false` → wizard; admin/superadmin bypass.
- Full-page wizard (no nav via `AppShell`), 5 steps + complete screen.
- Steps: personal, employment, banking/tax, emergency (skippable), documents (skippable, inline sign).
- Complete sets `onboarding_complete`, marks `onboarding_steps`, audits `onboarding_completed`.
- **Employees page:** onboarding column (X/5 steps) → detail modal.

#### Document Hub (`/app/documents?tab=official`)
- Tabs: Pay advices/invoices | Official documents.
- Admin upload: PDF/DOCX (20MB), category, signing type, assign employee or all.
- Employee: view/sign (e-signature canvas via `react-signature-canvas`) or acknowledge.
- `signature_data` never in list queries; signed URLs 1hr expiry.
- Audit: `official_document_uploaded`, `_signed`, `_acknowledged`, `_rejected`.

#### Nav
- **Leave** added for all roles.

#### Key files
- `src/lib/leave/*`, `src/app/app/leave/*`
- `src/app/app/onboarding/*`, `src/components/app/AppShell.tsx`
- `src/app/app/official-documents/actions.ts`, `src/components/official-docs/*`
- `src/components/marketing/HeroCanvas.tsx`
- `src/components/motion/FadeUp.tsx`

#### Manual step required
Run migration `20260612000000_phase5_leave_onboarding_docs.sql` against Supabase before deploying.

### Phase 6 ✅ — Performance, notifications, org settings, audit log, landing

#### Performance + snappiness
- **Client shell:** Sidebar and topbar stay mounted; page content transitions via `template.tsx` only (not full layout re-render).
- **NavigationProvider:** Teal top progress bar (Framer Motion, 2px, z-index 9999) on nav start; completes on route change.
- **Optimistic nav:** `NavLink` highlights clicked item immediately before page loads.
- **Motion tuning:** Page 120ms, cards 160ms, modals 120ms, dropdowns 80ms. Table rows fade together (no stagger); dashboard stat cards stagger max 3 at 40ms.
- **Skeletons:** `loading.tsx` for timesheet detail; `DocumentViewModal` opens instantly with spinner then iframe; `Avatar` lazy-load + grey placeholder.
- **RowActionsMenu:** Portal to `document.body` with `getBoundingClientRect()` positioning; opens upward near viewport bottom.

#### In-app notifications
- **Database:** `notifications` table + RLS (`supabase/migrations/20260613000000_phase6_notifications_org_logos.sql`).
- **Triggers:** Inserted in existing server actions — timesheet submit/approve/reject, leave request/approve/reject, official document assign/sign/acknowledge.
- **UI:** Bell in topbar; unread badge (teal, max 9+); dropdown panel 300×400px; mark all read; click → mark read + navigate; 60s poll.

#### Org settings (General tab)
- **Sections:** Organisation details (name, slug read-only + lock, currency dropdown, cadence dropdown), allowed domains (warn on remove if active employees), logo upload (PNG/JPG 2MB → `org-logos` bucket), danger zone suspend all employees (admin only, confirm modal).
- **Save per section** with `org_settings_updated` audit entries.
- **Logo:** Shown in sidebar bottom + embedded in generated PDFs via `@react-pdf/renderer` Image.

#### Audit log viewer (`/app/audit`)
- Admin + superadmin nav item (ClipboardList-style icon).
- Table: timestamp, actor, action, entity, human-readable details summary.
- Filters: actor, action, entity, date range; superadmin org selector.
- Paginate 50/page with Load more; Export CSV via `GET /api/audit/export`.

#### Profile completeness
- Animated progress bar on `/app/profile` (10 checkpoints).
- Missing-field chips scroll to section anchors.
- Added job details + emergency contact sections/forms.

#### Landing page enhancement
- Detailed dashboard mockup (mini sidebar, topbar, stat cards, gradient fade).
- Fourth feature card: Leave & onboarding.
- Credibility bar: Google Sheets · Xero · Slack · Gmail · QuickBooks.
- Hero headline word stagger (Framer Motion, 40ms, 200ms).
- Feature cards scroll-triggered fade-up; mobile tap targets min 44px.

#### New / updated files (this session)
- `src/components/app/NavigationProvider.tsx`, `NavLink.tsx`, `NotificationsBell.tsx`
- `src/app/app/template.tsx`, `src/app/app/notifications/actions.ts`
- `src/lib/notifications.ts`, `src/lib/audit/queries.ts`, `src/lib/audit/summarize.ts`
- `src/app/app/audit/`, `src/app/api/audit/export/route.ts`
- `src/app/app/settings/GeneralSettingsTab.tsx`, updated `actions.ts`, `page.tsx`
- `src/app/app/profile/ProfileCompleteness.tsx`, employment/emergency forms
- `src/components/documents/DocumentViewModal.tsx`, `src/components/ui/Skeleton.tsx`
- `src/components/motion/StatCardGrid.tsx`
- `supabase/migrations/20260613000000_phase6_notifications_org_logos.sql`
- `README.md` — full project description

#### Manual step required
Run migration `20260613000000_phase6_notifications_org_logos.sql` against Supabase before deploying.

### Phase 6 fix ✅ — Client-side exception after navigation

#### Root cause
- **`template.tsx` remounted `PageTransition` on every navigation.** Next.js templates create a new instance per route change, which destroyed `AnimatePresence` mid-exit animation. That left page transitions in a broken state and caused client-side exceptions.
- **Progress bar stuck:** `onAnimationComplete` used `definition === "animate"`, which Framer Motion 12 does not reliably pass for direct `animate` props — so the bar never cleared when pathname failed to update after a crashed transition.
- **Secondary:** Audit log entity filter called `router.push` on every keystroke, triggering rapid navigations. Notification poll lacked unmount guard.

#### Fix
- **Removed `src/app/app/template.tsx`.** `PageTransition` now lives inside persistent `AppShell` `<main>`, so `AnimatePresence` survives route changes.
- **`PageTransition`:** added `initial={false}` to skip enter animation on first mount.
- **`NavigationProvider`:** progress bar clears on `onAnimationComplete` unconditionally, on pathname change, and via 4s safety timeout.
- **`RowActionsMenu`:** portal renders only after client mount (`mounted` state).
- **`NotificationsBell`:** unmount guard on poll interval; async load handles server-action throws gracefully.
- **Audit log:** entity filter uses local draft + Apply button instead of navigate-on-keystroke.

### Phase 6 fix (audit page) ✅ — Client crash on /app/audit

#### Root cause
- **`TypeError: Cannot read properties of null (reading 'get')`** — `AuditLogViewer` called `useSearchParams().get(...)` during render. In Next.js 14, `useSearchParams()` can return `null` while the router is not ready (notably during client-side navigation). Unlike timesheets (which passes filter values as server props), audit read params directly in JSX on every render.
- Secondary: `MotionTR` with `whileInView` on table rows added unnecessary client complexity; removed in favour of plain `TR`.

#### Fix
- **Pass filter values as props** from the server page (`AuditFilters`), matching the timesheets pattern.
- **Null-safe `useSearchParams`** via `currentParams()` helper — only used for building next URL on filter change, never during render.
- **`Suspense` boundary** around audit content; **`error.tsx`** on the route so a crash here does not take down the app shell.
- **`fetchAuditLog`:** trims/ignores empty filter strings; returns empty on query error.
- **CSV export:** defaults to last 30 days when no date range is selected.

#### Manual step required
Run migration `20260613000000_phase6_notifications_org_logos.sql` against Supabase if not already applied (notifications table + org-logos bucket).

### Phase 5 fixes + landing enhancement ✅

#### Click responsiveness (definitive fix)
- **Root cause:** `startTransition(async () => …)` ends the transition when the async function returns a Promise — `isPending` flips off immediately, so buttons showed no loading state during the ~1s server round-trip.
- **Fix:** Replaced async `startTransition` with synchronous `useState` loading flags set **before** `await` in: `LeaveAdminView`, `LeaveTypesTab`, `TimesheetListTable` (bulk approve), `OnboardingWizard`, `LeaveEmployeeView` (cancel).
- **Removed artificial delays:** `UploadWizard` navigates immediately after submit; onboarding complete screen redirects without `setTimeout`.
- **Button:** `transition-all` → targeted transitions; `active:scale-[0.98]` for instant press feedback.
- **Landing hero:** Removed GSAP opacity fade on interactive hero content (text visible immediately; particle canvas unchanged).

#### Documents — View + Download
- Pay advices & invoices rows: **View** (opens 1hr signed URL in new tab) + **Download** (`download` attribute) via `DocumentActions.tsx`.
- Official documents rows: same View/Download pattern.

#### Superadmin — Settings & leave
- **Settings** nav item now includes `superadmin`.
- Superadmin settings defaults to **Leave types** tab with org dropdown (`?org=`).
- `upsertLeaveType` / `applyDefaultsToAll` accept org scope for superadmin; **Apply defaults to all employees** works per selected org.

#### Official documents — upload UI
- **Upload document** button on Official Documents tab (admin/superadmin), including empty state.
- Modal: file picker (PDF/DOCX, 20MB), name, category, assign employee or all, signing type.
- Superadmin: org selector in modal + documents list filter.
- Inline upload form removed from list panel; upload via modal only.

#### Landing page enhancements
- Larger hero headline (`text-8xl` on large screens) + dashboard mockup frame beside headline.
- Features: Lucide icons, teal left-border accent, expanded copy.
- Stats bar: 3 / 100% / 1 with GSAP `CountUp` on scroll-into-view (`startOnView` on `CountUp`).
- How it works: large teal step numbers + Lucide icons.
- Social proof: row of 3 testimonial cards.
- Footer: product tagline, **Back to top**, `/privacy` and `/terms` placeholder pages.
- Dependency: `lucide-react`.

#### New / updated files (this session)
- `src/components/documents/DocumentActions.tsx`
- `src/components/official-docs/OfficialDocumentUploadModal.tsx`, `OfficialDocumentsSection.tsx`
- `src/app/app/settings/SuperadminOrgSelect.tsx`
- `src/app/(marketing)/privacy/page.tsx`, `terms/page.tsx`
- `src/components/marketing/LandingPage.tsx` — full enhancement
- `src/components/motion/CountUp.tsx` — `startOnView` prop

### Framer Motion migration + UI fixes ✅

#### Motion system (app shell)
- **Installed** `framer-motion`; **GSAP retained only** for `LandingCountUp` (landing stats bar). HeroCanvas uses Three.js only.
- **Removed GSAP** from app shell: onboarding, approval controls, upload dropzone, dashboard CountUp, etc.
- **Page transitions:** `AnimatePresence mode="wait"` in `AppShell` via `PageTransition` (150ms fade+rise).
- **Nav:** static render; `whileHover={{ x: 2 }}` on sidebar/mobile links (100ms). Active state CSS-only.
- **Buttons:** `whileTap={{ scale: 0.97 }}` (80ms); inline spinner + preserved label via `loading` prop.
- **Cards:** `MotionCard` entrance (200ms, `viewport once`); hover = CSS box-shadow only.
- **Tables:** `MotionTR` stagger on first 8 rows (`viewport once`).
- **Modals:** `MotionModal` with scale+opacity panel and backdrop (150ms).
- **App CountUp:** Framer `animate()` + `useMotionValue` / `useTransform` (replaces GSAP in dashboard/leave).

#### Leave page — employee flow
- Employee view uses explicit `role === "employee"` routing.
- Balance cards built from leave types when no balance rows exist.
- Prominent **Request leave** CTA; month calendar grid with approved/pending highlights.
- Request history table with cancel via row actions menu.
- **Superadmin:** org dropdown at top → admin view scoped to selected org.

#### Full-width content
- Removed `max-w-5xl` cap from `AppShell` main panel; settings `max-w-3xl` removed.
- All `/app/**` pages fill available width between sidebar and viewport edge.

#### Table row actions menu
- `RowActionsMenu` (⋯) replaces overflowing per-row buttons on pay/official document tables.
- Pay docs menu: View, Download, Re-send, status change (managers).
- Official docs menu: View, Download, Sign/Acknowledge (employees).
- Framer `AnimatePresence` dropdown (100ms); closes on outside click + Escape.

#### New / updated files (this session)
- `src/components/motion/PageTransition.tsx`, `MotionCard.tsx`, `MotionModal.tsx`, `MotionTR.tsx`
- `src/components/motion/LandingCountUp.tsx` — GSAP stats only
- `src/components/ui/RowActionsMenu.tsx`, `buttonStyles.ts`
- `src/components/documents/PayDocumentRowActions.tsx`
- `src/components/official-docs/OfficialDocumentRowActions.tsx`
- `src/app/app/leave/LeaveOrgSelect.tsx`, updated `LeaveEmployeeView.tsx`, `page.tsx`

### Security, settings fix, robustness pass ✅

#### Settings page crash fix
- **Root cause:** Same as audit — `SettingsTabs` called `useSearchParams().get("tab")` during render; params can be `null` on client navigation.
- **Fix:** Server page parses `tab`/`org` into props; `SettingsContent` async child; `SettingsTabs` receives `tab` prop; `SuperadminOrgSelect` uses null-safe `currentSearchParams()` for URL updates only; `Suspense` + route `error.tsx`.

#### useSearchParams audit (all `/app/**` consumers)
- Shared helper: `src/lib/search-params.ts` → `currentSearchParams()`.
- Updated: `SettingsTabs`, `SuperadminOrgSelect`, `DocumentsTabs` (receives `tab` prop), `GenerateFromTimesheetsButton`, `OfficialDocumentsSection`, `LeaveOrgSelect`, `TimesheetFilters`, `TimesheetListTable`, `DocumentFilters`, `AuditLogViewer`.
- Pattern: never call `.get()` during render for display; props from server page; null-safe helper for filter URL building.

#### Error & loading boundaries
- `src/app/app/error.tsx` + `src/app/app/loading.tsx` (app-wide).
- `src/app/app/settings/error.tsx`; audit error uses shared `RouteError`.
- `src/components/app/RouteError.tsx` — reusable error UI.

#### Security — server actions
- **Official documents:** assignee verified in org; category/signing_type enum validation; signature size cap; rejection note max length.
- **Leave:** ISO date range validation; allocated days / year validation; note max length.
- **Leave types (settings):** category enum; default days validation; update payload whitelisted (no `org_id` on update).
- **Onboarding:** `parseBankingFormData` for banking; employment date validation; `completeOnboarding` requires personal/employment/banking steps complete.
- **Notifications:** typed `{ ok, message }` results; errors surfaced instead of `void`.
- **Profile:** start date ISO validation.

#### Security — API routes
- **`/api/google-sheet`:** 10 req/min/user rate limit; 10s fetch timeout; 5MB response cap; explicit `Content-Type: application/json`.
- **`/api/audit/export`:** ISO date validation; org existence check for superadmin; JSON error `Content-Type` headers.
- **`/api/documents/generate`:** requires `application/json` body; explicit JSON response headers.
- **`/api/timesheets/export`:** JSON error responses include `Content-Type`.

#### Security — auth
- **`SUPERADMIN_EMAIL` backstop:** only promotes profiles with `status = 'pending'`; never demotes or changes active users (`src/lib/onboarding.ts`).

#### Security — document generation
- Invoice generation blocked when employee banking incomplete (clear error before PDF).
- Email or upload failure rolls back storage + DB row (`rollbackDocument` in `generate.tsx`).

#### Security — RLS & storage migration
- New migration: `supabase/migrations/20260614000000_security_rls_storage.sql`
- **Timesheets bucket** policies (private, org/employee scoped).
- **Documents / official-documents storage** — org-scoped read/write; admin-only inserts where appropriate.
- **Org-logos** — write restricted to admin/superadmin in own org folder; public read unchanged.
- **Documents insert RLS** — admin/superadmin only.
- **Leave types write** — split into insert/update/delete with `is_active()` check.
- **Leave RPCs** — caller role/org authorization inside `approve_leave_request` / `reject_leave_request`; `GRANT` to authenticated only.
- **Onboarding steps** — employees insert/update only (no delete policy).
- **Audit log / webhook_deliveries** — read policies for admin/superadmin.

#### Robustness & performance
- `src/lib/fetch.ts` — `fetchWithTimeout` (10s default).
- `src/lib/supabase/server.ts` — `cache: 'no-store'` on all server Supabase fetches.
- `src/lib/validation.ts` — extended helpers (ISO dates, enums, max length, year, non-negative numbers).
- Installed `zod` (available for future schema migration; validation helpers used in this pass).

#### Dependency audit
- `npm audit`: remaining highs are **Next.js** (fix requires major upgrade to v16 — deferred).
- Updated `@supabase/ssr`, `framer-motion`, Next 14 patch line (already latest 14.2.x).

#### Manual step required
Run migration `20260614000000_security_rls_storage.sql` against Supabase before deploying.

### Settings `.map` crash + Google Sheets header mapping ✅

#### Settings — `p.map is not a function`
- **Root cause:** `GeneralSettingsTab` imported `COMMON_CURRENCIES` from `"use server"` `actions.ts` in a Client Component — Next.js does not reliably bundle non-action exports from server files, so the value was not an array at runtime. `Select` then called `options.map()` and threw.
- **Fix:** Moved `COMMON_CURRENCIES` to `src/lib/constants.ts` (client-safe). Added `src/lib/org-utils.ts` with `normalizeAllowedDomains()`, `formatAllowedDomains()`, `ensureArray()`.
- **Defensive checks:** `SettingsContent` normalizes `allowed_domains` from DB (null / Postgres literal / string → array); `ensureArray()` on orgs list and leave types; `GeneralSettingsTab`, `LeaveTypesTab`, `SuperadminOrgSelect`, `SettingsForm` guard all `.map()` calls.

#### Google Sheets — URL showing as column header
- **Root cause:** Google Sheet CSV often has a link or title row before real headers; `detectHeaderOffset` treated a single-cell URL row as the header row.
- **Fix:** Shared import pipeline in `src/lib/timesheets/parse.ts`:
  - `sanitizeImportGrid()` — strips leading blank / URL / link rows
  - `prepareImportTable()` — sanitize → detectHeaderOffset → tableFromGrid (single entry point)
  - `detectHeaderOffset()` — ignores junk rows when scanning for payroll header and width mode
- **UploadWizard:** all three methods (file, paste, Google Sheets) call `prepareImportTable()` via `applyGrid()`; skip-rows changes use the same helper.
- **HeaderMapping:** defensive `Array.isArray(table.headers)` before mapping.

### Logo upload, org logo display, Google Sheets import fix ✅

#### Logo upload
- **Root cause:** Production failures from missing bucket, opaque storage errors, or path issues.
- **Fix:** `uploadOrgLogo` wrapped in try/catch; uses `createAdminClient()` + `{org_id}/{timestamp}.{ext}` path; returns `{ ok, message, logoUrl }` for immediate preview; logs storage errors; rolls back DB if update fails after upload.
- **Migration:** `supabase/migrations/20260615000000_org_logos_bucket.sql` ensures public `org-logos` bucket exists.

#### Org logo display
- **`OrgLogo` component** (`src/components/brand/OrgLogo.tsx`) — teal `#1F8A8A` letter placeholder, consistent sm/md/lg sizes.
- **Sidebar** bottom org block uses `OrgLogo`.
- **Dashboard** admin + org drill-down: `PageHeader` shows org logo + name.
- **Superadmin org cards** + **Organizations table** rows show logo/placeholder.
- **PDFs:** `resolveOrgLogoDataUrl()` fetches logo server-side, embeds as base64 in pay advice + invoice.

#### Google Sheets import — empty column dropdowns
- **Root cause:** `sanitizeImportGrid()` was too aggressive (stripped multi-cell rows and blank rows); file/paste shared the same pipeline.
- **Fix:** Sanitization rule — strip only rows with **exactly 1 cell** that is blank or a URL; never strip 2+ cell rows.
- **Separate pipelines:** file upload + paste use original `detectHeaderOffset` + `tableFromGrid`; Google Sheets uses `prepareGoogleSheetTable()` only.
- **`/api/google-sheet`:** logs status, content-type, first 500 chars; clear publish hint toast on failure.

### Logo upload multipart + Google Sheets URL leak ✅

#### Logo upload — Server Component render error
- **Root cause:** Logo `<form>` was missing `encType="multipart/form-data"`, so the file never arrived as a `File` in the server action (default `application/x-www-form-urlencoded` cannot carry binary uploads). Server action then failed unpredictably during upload/revalidate.
- **Fix:** Added `encType="multipart/form-data"` to the logo form in `GeneralSettingsTab.tsx` (matches `OfficialDocumentUploadModal`).
- **Server action hardening (`uploadOrgLogo`):** Auth moved outside try/catch; `isRedirectError` re-thrown; validates `formData.get("logo") instanceof File`; uploads `Uint8Array` from `file.arrayBuffer()` via `createAdminClient()` service-role client; structured Vercel logging (`orgId`, path, size, JSON-stringified storage errors).

#### Google Sheets — URL leaking into column mapping
- **Root cause:** Global `window` paste handler intercepted URL pastes into the Google Sheet URL `<input>`, ran the **file/paste** pipeline (`applyGrid` → no URL sanitization), and treated the URL string as the header row.
- **Fix:**
  - Paste handler skips events when target is `input`, `textarea`, or `contentEditable`.
  - Paste handler ignores `isSpreadsheetUrlOnly()` text (URLs must use Import sheet button).
  - New helpers in `parse.ts`: `isSpreadsheetUrlOnly()`, `csvLooksLikeUrlLeak()`.
  - `/api/google-sheet` rejects bodies that look like a bare URL (not CSV).
  - `fetchGoogleSheet()` validates `json.csv` with `csvLooksLikeUrlLeak()` before parsing.
- **Verified:** Public sheet `1CTgM1g_aYoWFFpHU6A_qyqWGH0ulCFhs67uAcRVf1Rw` exports CSV with real column headers (`last_name`, `first_name`, …) and 537 data rows.

### Settings superadmin crash + upload wizard overhaul ✅

#### Settings — Server Component render error (superadmin)
- **Root cause:** Superadmin org scope used `filters.org || admin.org_id`, and org fetch used `.single()` without guarding errors. Superadmin has no fixed `org_id`; loading without an `?org=` param could hit bad scope or throw on fetch errors.
- **Fix (`SettingsContent.tsx`):**
  - Superadmin org scope uses **only** the `org` search param — never `profile.org_id`.
  - No org param → org selector + empty state (no org fetch).
  - Admin uses session client + their `org_id` only; superadmin uses admin client.
  - `.maybeSingle()` + explicit error logging; try/catch logs full error to Vercel before rethrow.
  - `SettingsTabs` / `SuperadminOrgSelect` wrapped in `Suspense` (they use `useSearchParams`).
  - Removed stale `export { COMMON_CURRENCIES }` from `"use server"` `actions.ts`.

#### Upload wizard — two-method UI (file + paste)
- **Removed:** Google Sheets URL import UI and global `window` paste listener. `/api/google-sheet` route remains in codebase but has no UI entry point.
- **Layout:** Single card, two sections stacked with “or” dividers; Framer Motion stagger (40ms, 160ms fade, once).
- **Section 1 — Upload:** Teal drag-over dropzone (`.csv`/`.xlsx`, 10MB); teal sample-template banner with client-side CSV download (DATE, DAY, START TIME, END TIME, TOTAL HOURS, PROJECT, DESCRIPTION, BILLABLE + 5 example rows).
- **Section 2 — Paste:** Explicit textarea; parse only on paste into the box (not page-level). Helper text for Google Sheets copy flow.
- **Pipeline:** Both methods → `detectHeaderOffset` → `tableFromGrid` → `autoMatch` → mapping (always) → preview → submit.
- **Mapping step:** Always shown after parse; all column dropdowns pre-filled with auto-detected matches for review/adjustment. Required fields (Date + Hours or Start + End time) block continue if unset.
- **HeaderMapping:** URL-like column headers excluded from dropdown options (`isUrlLikeCell`).

### Phase 7 ✅ — In-app time tracking

#### Database
- Migration: `supabase/migrations/20260616000000_phase7_time_tracking.sql`
- **`projects`** — org-wide (admin-managed) or personal (employee-owned); soft-delete via `is_active = false`
- **`time_entries`** — linked to `timesheets` via `timesheet_id`; `total_hours` stored (not generated) to support overnight shifts via `is_overnight`; overlap guard server-side
- RLS: org members read projects; employees manage personal projects; admin/superadmin manage org-wide; time entries scoped to employee (admin/superadmin read org)

#### Removed (upload flow)
- `/app/timesheets/new` upload wizard (file, paste, mapping, preview)
- `/api/google-sheet` route
- `src/lib/timesheets/{parse,map,columns,types,validation}.ts`
- Dependencies: `papaparse`, `xlsx`, `@types/papaparse` uninstalled
- **`timesheets` + `timesheet_rows` retained** for period container, approval flow, and legacy uploaded data

#### Time entry UI (`/app/timesheets` — employees)
- **Left panel (60%):** period selector (back/forward), week day rows (Mon–Sun within period), inline entry rows (start/end, live hours, project, description, billable, delete)
- **Right panel (40%):** period summary — total hours (GSAP CountUp), project breakdown, billable split, estimated earnings (hourly only), days logged, submit for approval
- Auto-save on blur with ✓ Saved indicator (Framer Motion, 1s fade)
- Overnight shift: user must confirm when end < start (`is_overnight = true`)
- Server overlap validation on insert/update
- Auto-creates draft `timesheets` row for period on first visit (`ensureTimesheetForPeriod`)
- Submit sets status `submitted`; entries read-only while submitted/approved; rejected → editable again

#### Admin live visibility
- Admin timesheet list shows all employees including **draft** timesheets
- Draft badge shows **Live** (in-progress entries)
- Admin detail view read-only for others' drafts; approve/reject only when `submitted`

#### Projects (`/app/projects`)
- Nav item for all roles (FolderOpen icon)
- Employees: read org-wide projects; create/edit/archive personal projects (name + preset colors)
- Admin/superadmin: manage all org-wide + view personal projects in org

#### Trends (`/app/trends`)
- Nav item for all roles (TrendingUp icon)
- Employee: line chart (hours per period), bar charts (project, day-of-week avg over 8 weeks), 12-month heatmap, summary stats
- Admin: org aggregate charts + stacked bar (hours by employee, last 8 periods) + employee breakdown table
- Superadmin: org selector → admin trends for selected org
- Range selector: weekly / fortnightly / monthly / 6-month / yearly

#### Notifications
- **`time_log_reminder`** — in-app only on page load if no entries in last 3 days within active period (`checkTimeLogReminder`)
- Existing: timesheet submitted (admin), approved/rejected (employee)

#### Key files
- `src/lib/time/periods.ts` — pay period + week navigation
- `src/lib/time/validation.ts` — time parsing, overlap, overnight
- `src/lib/time/trends.ts` — trend queries
- `src/app/app/timesheets/time-actions.ts` — CRUD + submit + reminder
- `src/app/app/timesheets/TimeTrackingView.tsx` — main employee UI
- `src/app/app/projects/` — projects management
- `src/app/app/trends/` — trends charts

#### Manual step required
Run migration `20260616000000_phase7_time_tracking.sql` against Supabase before deploying.

### Phase 7 fixes ✅

#### Admin/superadmin time entry
- **`/app/timesheets/log`** — time entry UI for any role with `profiles.org_id` (not employee-only)
- **"Log my time"** button on timesheet list page (next to Export CSV) when user has an org
- Managers keep list view for team oversight; personal logging uses `/app/timesheets/log`

#### Delete timesheets
- Row **⋮ menu → Delete** on timesheet list (draft/rejected only)
- Confirm modal; server deletes `time_entries` then `timesheets` row
- Role rules: owner, org admin (same org), or superadmin
- Audit: `timesheet_deleted`

#### Projects
- Superadmin must select org before creating projects — validation: "Please select an organisation first."
- Time entry dropdown loads via `fetchProjectsForTimeEntry()` — org-wide + own personal only (separate queries, not `.or()` join)
- Org-wide projects show org name column for superadmin on Projects page
- Managers can archive org-wide projects from Projects page

#### Superadmin as a regular user
- Personal features scoped to `profiles.org_id` (time entry, submit, leave, trends, onboarding, documents)
- Superadmin with `org_id`: personal dashboard + org cards on `/app/dashboard`
- Admin/superadmin with `org_id`: personal leave view above team admin view
- Admin/superadmin with `org_id`: "Your trends" section on `/app/trends`
- Onboarding no longer restricted to `employee` role (middleware + page)
- Superadmin self-service: rate/banking editable on own row in Employees table
- Time log reminder applies to any user with `org_id`, not employees only

### Log time fixes ✅

#### Project selection persistence
- `saveEntry()` reads latest row state via refs (fixes stale closure on blur)
- Project `onChange` awaits `saveEntry()` with explicit `project_id`
- `upsertTimeEntry` logs `project_id` server-side; explicit null/UUID handling
- Removed full `load()` after every save — local state updated with returned `id` + `project_id`

#### Submit for approval
- Orphan `time_entries` (null `timesheet_id`) auto-linked to period timesheet on load and submit
- Entry queries use `entry_date` within period (not only `timesheet_id` filter)
- Submit counts entries via linked timesheet + period fallback

#### UI
- Days logged counts distinct dates with saved entries or complete start/end times
- Page title: `Log time · Cadence` on `/app/timesheets/log` and employee `/app/timesheets`

### Phase 7 — Weekly submission model ✅

**Issues #1, #2, #3 — RESOLVED** (core log → submit loop)

#### Model
- **Submission unit is the calendar week (Mon–Sun).** `period_start` = Monday, `period_end` = Sunday.
- Org `default_cadence` no longer gates submission; it only affects pay-doc grouping later.
- Partial unique index: one active timesheet per `(employee_id, period_start)` for status in `draft` / `submitted` / `rejected`.
- `timesheets.has_overtime` + `timesheets.overtime_hours` set server-side on submit when total hours > 40.

#### `/app/timesheets/log` (and employee `/app/timesheets`)
- Weekly nav: Prev week / This week / Next week; header shows Mon–Sun range + ISO week label.
- Fetch-or-create draft timesheet for `(employee, week Monday)` via `ensureTimesheetForWeek` (handles unique-index race with `23505` retry).
- Mon–Fri working-day rows; multiple entries per day; auto-save on blur (~600ms debounce) + per-row Save button.
- Per-row save state: idle / saving / saved / error (retry on error).
- Submit gate (server-enforced): `days_logged >= 5 OR total_hours >= 40`; progress shown as `4 / 5 days · 32.0 / 40.0h`.
- Overtime notice before submit when > 40h; manager sees `Overtime +X.Xh` badge on list + detail.

#### Key files
- `src/lib/time/week-constants.ts` — shared submit thresholds + `WeekStats` type
- `src/lib/time/week-stats.ts` — server-side `computeWeekStats`, `canSubmitWeek`, `overtimeHours`
- `src/lib/time/periods.ts` — `mondayOfWeek`, `weekPeriodFromMonday`, `isoWeekLabel`, `workingWeekDays`

### Phase 7 — Time entry insert fix + log UI redesign ✅

#### Root cause (insert silently failing)
- Server action `upsertTimeEntry` sent **`is_overnight`** in the insert/update payload.
- Live `time_entries` schema no longer has that column (`total_hours` is `GENERATED ALWAYS`).
- Postgres rejected the insert; the action returned generic `"Couldn't create entry."` without surfacing `error.message`.

#### Fix
- Time entry **create/update/delete** now uses the **browser Supabase client** (`@/lib/supabase/client`) under RLS.
- Insert payload is **exactly**: `org_id`, `employee_id`, `timesheet_id`, `project_id`, `entry_date`, `start_time`, `end_time`, `description`, `billable` — never `total_hours` or `is_overnight`.
- `org_id` / `employee_id` / `timesheet_id` asserted from session + `ensureTimesheetForWeek()` before insert.
- `total_hours` read back from `.select("id, total_hours")` after save for summary display.
- Real Postgres errors surfaced inline on the row; **Retry** only when `error !== null`.

#### Week summary
- Totals, by-project breakdown, billable split, and submit progress recomputed from **persisted** entries (`total_hours` from DB).
- Estimated earnings = `total_hours × employee rate` (single currency, no FX).

#### Log UI redesign (`TimeTrackingView`)
- Day cards: surface bg, hairline border, 16px radius, Space Grotesk headings.
- Entry rows: aligned time inputs, duration chip, project select with inline color dot, description flex-grow, styled billable toggle, save-state indicator (saving/saved ✓/error), quiet delete icon.
- Framer Motion 160ms on row add/remove; week summary panel tightened with tabular-nums throughout.

#### Key files
- `src/lib/time/time-entry-client.ts` — RLS-scoped save/delete
- `src/lib/time/week-stats-client.ts` — client-side stats from persisted entries

### Phase 7 — Log UI polish ✅

#### Ghost entry / phantom overlap fix
- **Root cause:** concurrent debounced saves could insert twice before `entry.id` was written back, leaving an invisible DB row that still triggered overlap; overlap also counted invalid/zero-duration rows.
- Draft rows never persist until `canPersistTimeEntry()` (valid start + end, positive duration).
- Overlap compares only persisted rows with valid times; excludes self by `id`; in-flight save deduped per `clientId`.
- Cleanup SQL: `supabase/scripts/cleanup_ghost_time_entries.sql` (SELECT preview, then DELETE).

#### Seven-day view
- Mon–Sun day cards; Sat/Sun styled as optional weekend (dashed border, muted label). Submit gate unchanged — weekend days count normally.

#### Load performance
- `getTimeTrackingData`: parallel `ensureTimesheetForWeek` + projects, then parallel orphan-link + entries-by-`timesheet_id` + `computeWeekStats`.
- Skeleton loaders for day cards + summary (`LogWeekSkeleton`).
- Optional index migration: `supabase/migrations/20260617000000_time_entries_perf_index.sql` (`employee_id, entry_date`).

#### Entry row rebuild
- `TimeEntryRow.tsx`: stacked layout — times + duration chip (separate, never overlapping inputs), project dot inline, description, billable toggle, save state, delete. Framer Motion 160ms.

### Task A fixes ✅ — Duration chip, window.prompt removal, timesheet status actions

#### Fix 1 — Duration chip layout
- `TimeEntryRow.tsx`: removed the inner `<div>` wrapper around time inputs. Start time, dash, end time, and chip are now all **direct siblings** in a flat `flex flex-wrap` container — chip can never overlap the end-time field. Time inputs use `w-[7.5rem] flex-none` for cross-browser consistency.

#### Fix 2 — Replace window.prompt()
- `CreateProjectModal` component added in `TimeEntryRow.tsx`: branded MotionModal with name input, preset color swatches (gold ring on selected), Cancel + Create buttons. No `window.prompt/alert/confirm` anywhere in the codebase.
- `handleCreateProject` in `TimeTrackingView.tsx` now accepts optional `color` param, passed to `createProject` action.

#### Fix 3 — Status-based timesheet actions
- `editableStatus()` in `time-actions.ts`: now includes "submitted" — entries are editable while submitted.
- `TimeTrackingView.tsx`: `editable` flag updated to include submitted.
- New server actions in `actions.ts`:
  - `recallTimesheet(id)` — submitted → draft; auth: owner/admin/superadmin; audit: `timesheet_recalled`
  - `returnTimesheetToDraft(id)` — rejected → draft, clears rejection_note; audit: `timesheet_returned_to_draft`
  - `deleteTimesheet(id)` — now supports ALL statuses. Writes audit BEFORE delete. Manually cleans: time_entries, timesheet_rows, webhook_deliveries, nulls documents.timesheet_id (documents preserved). Logs FK errors to Vercel.
- `DeleteTimesheetControl.tsx`: works for all statuses. Approved: shows danger warning. Has document: shows preservation notice. Optional `redirectTo` prop (detail page uses `/app/timesheets`).
- New `TimesheetStatusActions.tsx`: Recall button (submitted), Edit & resubmit button (rejected, navigates to log view with `?week=` param).
- `TimesheetListTable.tsx`: `canDeleteRow` no longer restricted to draft/rejected; TimesheetStatusActions added per row.
- Detail page `[id]/page.tsx`: Queries `documents` for `hasDocument`; surfaces Delete + Recall/Resubmit in header; rejection card shows Edit & resubmit CTA prominently.

**SQL note:** If `timesheets` FK delete fails despite manual cleanup, run the owner-visible migration below to ensure cascades are clean:
```sql
-- Surface only — run if deleteTimesheet logs FK errors in Vercel
-- (Check current FK constraints first: \d timesheets in psql)
```

### Task A — Accent swap + dark mode ✅

#### A1 — Warm Gold token swap
- All Mineral Teal values (`#1F8A8A`, `#2AA6A6`, `rgba(31,138,138,*)`, `#157070`, `#4FC3C3`) replaced with Warm Gold throughout the codebase.
- `globals.css`: `--accent #B8862F`, `--accent-soft rgba(184,134,47,0.12)`, `--accent-strong #A0751F` (light); `--accent #C9973F`, `--accent-soft rgba(201,151,63,0.16)`, `--accent-strong #B8862F` (dark).
- Charts: `DashboardCharts.tsx`, `TrendsCharts.tsx` — primary series gold (`#B8862F` / `#C9973F`).
- `OrgLogo.tsx` fallback placeholder: `bg-[var(--accent)]` (token-driven, not hardcoded).
- `HeroCanvas.tsx` particle color: `0xB8862F` (light) / `0xC9973F` (dark).
- PDF styles (`pdf/styles.ts`) and email HTML (`generate.tsx`): `#B8862F`.
- Leave seeds, fallback colors, settings defaults: `#B8862F` / `#A0751F`.
- `PROJECT_PRESET_COLORS[0]`: `#B8862F`.

#### A2 — True black dark mode
- Dark bg: `#000000`, surface: `#0D0D0D`. Visually distinct: surface has subtle `#0D0D0D` warmth against pure black bg.
- Dark muted: `#6B6F76` (same as light per spec); line: `rgba(237,237,234,0.08)`.

#### A3 — Duration chip layout (already clean)
- `TimeEntryRow.tsx` chip is a sibling flex item outside the time-inputs container — never overlapping. Confirmed no change needed.

### Session — Build fix, gold accent verify, pickers, perf, invites, pending removal ✅

#### Item 0 — Build fix
- Added missing `AuditAction` values: `timesheet_recalled`, `timesheet_returned_to_draft` in `src/lib/audit.ts` + summarize entries in `src/lib/audit/summarize.ts`.
- `documents.timesheet_id?: string | null` on Update type in `src/types/db.ts` (deleteTimesheet orphan flow).
- PDF `Image` alt: `@react-pdf/renderer` has no `alt` prop — eslint-disable in `InvoicePdf.tsx` / `PayAdvicePdf.tsx`.

#### Item 1 — Teal → gold (verify)
- `--accent-rgb` in `globals.css`; charts via `useChartColors()` in `src/lib/chart-colors.ts`.
- `TrendsCharts.tsx`, `DashboardCharts.tsx`, sidebar/topbar pills, `MeshBackground.tsx` all token-driven.

#### Item 2 — Custom TimePicker
- `src/components/ui/TimePicker.tsx` — gold accent, 160ms Framer Motion popover, hour/minute columns.
- `TimeEntryRow.tsx` — replaced native `<input type="time">`.

#### Item 3 — Custom DatePicker
- `src/components/ui/DatePicker.tsx` — branded calendar popover, gold selected state.
- Replaced native `type="date"` in: leave modal, audit log, timesheet export/controls, documents controls, profile employment form, onboarding wizard.

#### Item 4 — Timesheet load speed
- **Root cause:** client-only `getTimeTrackingData` on mount + redundant `computeWeekStats` DB query + duplicate auth.
- **Fix:** `src/lib/time/get-time-tracking-data.ts` — single auth pass, `weekStatsFromEntries` (no extra query).
- `TimeTrackingData` type in `src/types/time-tracking.ts` (client-safe).
- SSR prefetch in `timesheets/log/page.tsx` and employee path in `timesheets/page.tsx`.
- `TimeTrackingView.tsx` accepts `initialData`, skips initial client fetch when SSR data present.

#### Item 5 — Invite flow
- Migration: `supabase/migrations/20260619000000_org_invites_owner_role.sql` — `owner` enum value, `org_invites` table + RLS, `documents.timesheet_id` nullable.
- `src/lib/invites.ts` (`redeemOrgInvite`), `InviteMemberModal.tsx`, `invite-actions.ts` (Resend email).
- `/app/employees` — Invite button; owner/manager hierarchy (manager can only invite/assign Employee).
- Audit: `member_invited`; `roleLabel()` shows admin as “Manager”.

#### Item 6 — Remove pending gate
- `runOnboarding()` — new users land **active**; invite redemption first; domain match attaches org; no admin approval step.
- `/auth/callback` → `/app/onboarding` or `/app/dashboard`; suspended → `/login?error=suspended`.
- Middleware — only `suspended` blocked; `/pending` redirects away; page deleted.
- Login copy updated; error banner for suspended/OAuth failures.
- Removed unused `ApproveButton` (legacy pending UI).

#### Manual step required
Run migration `20260619000000_org_invites_owner_role.sql` in Supabase SQL editor before testing invites in production.

### Session — Unstick test account, remove from org, list refresh, decimal hours ✅

**Branch:** `cursor/unstick-test-account-edab` (continues open PR #8 `cursor/teal-to-gold-accent-f09b`, not yet merged to `main`).

#### Item 1 — Unstick owner test account
- **SQL script:** `supabase/scripts/unstick_owner_test_account.sql` — preview SELECTs then DELETE pending `org_invites` + UPDATE `profiles` (`org_id = null`, keep account).
- **Node runner:** `scripts/unstick-test-account.mjs` — same cleanup via service-role (`node scripts/unstick-test-account.mjs <email>`).
- **Default target email:** `iamsharjeeel@gmail.com` (replace in script if a `+alias` test address was used).
- **Agent note:** Cadence Supabase project (`irybkcryeywmwpcmhlaa`) was not reachable via MCP in this environment — owner should run the script/SQL in Supabase SQL editor or locally with Vercel env vars. No `auth.users` deletion required for typical stuck-invite cases.

#### Item 2 — Remove from org (membership only)
- `removeMemberFromOrg` + `cancelOrgInvite` in `src/app/app/employees/remove-actions.ts`.
- `RemoveMemberModal.tsx` / `CancelInviteButton.tsx` — gold-accent `MotionModal` confirmations.
- Clears `profiles.org_id` and deletes pending `org_invites` for that email in the org. **Does not** delete `profiles` or `auth.users`. Full account deletion remains deferred (GDPR).
- Hierarchy: owners remove managers + employees; managers remove employees only; cannot remove self, owners (as manager), or superadmins.
- Audit: `member_removed`, `member_invite_cancelled`.

#### Item 3 — Employees list refresh after mutations
- **Root cause (invites):** sent invites lived only in `org_invites`, not `profiles` — list had no pending-invites section.
- **Fix:** Pending invites table on `/app/employees`; `revalidatePath('/app/employees')` in server actions + `router.refresh()` in client modals after invite send / removal / cancel.
- **Signup completion:** `EmployeesListRefresh.tsx` polls `router.refresh()` every 30s while pending invites exist (no Realtime subscription).

#### Item 4 — Decimal hours entry mode
- Migration: `supabase/migrations/20260620000000_time_entry_decimal_mode.sql` — `entry_mode` (`time_range` | `decimal_hours`) + nullable `decimal_hours`.
- `src/lib/time/decimal-hours.ts` — synthetic times: `start_time = 00:00`, `end_time = 00:00 + N hours`.
- **Generated `total_hours` validation:** live column is `GENERATED ALWAYS` from `(end_time - start_time)` in hours; `00:00` → `07:30` yields exactly `7.5`. Overlap check skipped for decimal mode (synthetic times are not real clock ranges).
- `TimeEntryRow.tsx` mode toggle; `time-entry-client.ts` writes `entry_mode` + `decimal_hours`; existing rows default to `time_range`.

#### Manual steps required
1. Run `supabase/migrations/20260620000000_time_entry_decimal_mode.sql` before decimal-hours testing.
2. Run Item 1 cleanup SQL/script for stuck test email if not already done.

### Session — Asana OAuth + project import ✅

**Branch:** `cursor/asana-oauth-integration-894a` (branched from PR #9 `cursor/unstick-test-account-edab`, which is still open — not merged to `main`).

**PR #9 status:** Open on `cursor/unstick-test-account-edab`; 4 commits ahead of `main`. This session continues that branch lineage.

#### Architecture
- **Per-user OAuth** — each Cadence user connects their own Asana account; not org-scoped.
- **Entry point:** Profile → **Connected accounts** (`/app/profile#section-connected`).
- **OAuth flow:**
  - `GET /api/asana/connect` — sets httpOnly state cookie, redirects to `https://app.asana.com/-/oauth_authorize`
  - `GET /api/asana/callback` — exchanges code, stores tokens, redirects to `/app/profile?asana=connected`
  - Scope: `projects:read` (list workspaces + projects)
- **Token encryption:** AES-256-GCM via existing `DOCUMENT_ENCRYPTION_KEY`, scrypt salt `cadence-asana-v1` (`src/lib/asana-crypto.ts`). Same pattern as bank fields; tokens never sent to client.
- **Token refresh:** `getValidAsanaAccessToken()` refreshes when expired or within 5 minutes of expiry (`src/lib/asana/connection.ts`).
- **Disconnect:** revokes access token via Asana `/-/oauth_revoke`, deletes `asana_connections` row + all `asana_imported_projects` for user (clean slate — user can reconnect and re-import).

#### Database (`supabase/migrations/20260621000000_asana_oauth.sql`)
- **`asana_connections`** — `user_id` (unique FK → profiles), `access_token_enc`, `refresh_token_enc`, `expires_at`, `asana_user_gid/name/email`, timestamps. RLS: user SELECT/DELETE own row; INSERT/UPDATE via service role only.
- **`asana_imported_projects`** — `user_id`, `asana_project_gid`, `asana_project_name`, `asana_workspace_gid/name`, `imported_at`. Unique `(user_id, asana_project_gid)`. RLS: user CRUD own rows only.
- **Intentionally separate** from org-scoped `projects` table — personal reference layer until entry linking is designed.

#### UI
- `ConnectedAccountsSection.tsx` — connect button, connected state, disconnect modal, imported list + remove, sync names.
- `AsanaImportModal.tsx` — workspace-grouped checkbox list, gold-accent MotionModal.

#### Key files
- `src/lib/asana/config.ts`, `connection.ts`, `projects.ts`, `asana-crypto.ts`
- `src/app/api/asana/connect/route.ts`, `callback/route.ts`
- `src/app/app/profile/asana-actions.ts`, `ConnectedAccountsSection.tsx`, `AsanaImportModal.tsx`

#### Manual step required
Run `supabase/migrations/20260621000000_asana_oauth.sql` in Supabase SQL editor before testing Asana connect/import in production.

#### Next session — linking to timesheet entries
**Built** — see “Session — Asana entry picker…” above. Imported projects tag entries via `asana_project_id` without mapping to org `projects`.

#### Token refresh — owner verification (later)
If access token expiry can't be observed in one session: run in Supabase SQL editor:
```sql
UPDATE asana_connections
SET expires_at = now() - interval '1 minute'
WHERE user_id = '<your-user-uuid>';
```
Then open Import projects — should succeed without re-OAuth (refresh happens server-side).

### Stabilization session ✅ — Asana scopes, self-service rate, unassigned users, entry collapse

#### Item 1 — Asana centralized scopes + reconnect flow
- **`ASANA_REQUIRED_SCOPES`** in `src/lib/asana/config.ts` — single source of truth: `projects:read`, `workspaces:read` (space-delimited for OAuth `scope` param).
- **`src/lib/asana/errors.ts`** — detects Asana "must be present" scope errors; surfaces `ASANA_RECONNECT_MESSAGE` instead of raw API text.
- **Import projects / sync:** on insufficient scope → "Reconnect Asana to grant additional permissions" + Reconnect button (re-triggers `/api/asana/connect` with current scopes).
- **Reconnect upsert:** `upsertAsanaConnection` uses `onConflict: "user_id"` — existing row updated, not duplicated.
- **Owner action:** existing connections issued under old `projects:read`-only scope must reconnect once after deploy.

#### Item 2 — Employee self-service rate
- **Profile → Employment:** Rate field editable via `ProfileRateForm.tsx`; Role/Status remain read-only/admin-managed.
- **`updateOwnRate`** server action — no approval gate; flows into week summary estimated earnings same as admin-set rate.
- **Audit:** `profile.rate_change` payload includes `source: "self"` (Profile) vs `source: "admin"` (Team table).
- **Future note:** rate-at-submission-time versioning on past pay advices not built — current rate used for at-a-glance estimates only.

#### Item 3 — Unassigned users on Team page
- **Investigation:** Org-scoped admin/owner query already filters `.eq("org_id", actor.org_id)` — unassigned users do **not** leak into an org's Team table.
- **Superadmin global view:** unassigned users (`org_id` null) correctly appear with Organization = "Unassigned" — platform oversight, not a query bug.
- **Fix:** Unassigned rows hide Role/Status/Rate/Banking/Onboarding controls; superadmin gets **Assign to org** modal (`assignMemberToOrg` + `AssignMemberModal.tsx`). Audit: `member_assigned`.
- **`iamsharjeeel@gmail.com` test row:** still visible on superadmin Employees until assigned via new action; hidden from org-scoped Team views.

#### Item 4 — Auto-collapse saved time entries
- Saved entries collapse to compact summary row (time range or decimal total, project + color dot, billable badge).
- Click summary to re-expand for editing; new/unsaved entries stay expanded; add-entry does not disturb collapsed rows.
- Framer Motion 160ms consistent with existing row transitions.

#### Key files (this session)
- `src/lib/asana/config.ts`, `src/lib/asana/errors.ts`
- `src/app/app/profile/ProfileRateForm.tsx`, updated `actions.ts`, `AsanaImportModal.tsx`, `ConnectedAccountsSection.tsx`
- `src/app/app/employees/assign-actions.ts`, `AssignMemberModal.tsx`, updated `page.tsx`
- `src/app/app/timesheets/TimeEntryRow.tsx`, `TimeTrackingView.tsx`

### Session — Asana entry picker, connect toast, branding, reconnect notifications ✅

#### Item 1 — Asana project picker on time entry rows
- **Schema:** `time_entries.asana_project_id` nullable FK → `asana_imported_projects.id` (`ON DELETE SET NULL`); migration `20260622000000_time_entry_asana_project.sql`
- **UI:** `AsanaProjectPicker` alongside Cadence project dropdown (visually distinct — coral-tinted select + Asana icon); both Time range and Total hours modes
- **Persistence:** `saveTimeEntryClient` writes `asana_project_id`; collapsed summary shows Asana icon + project name when set
- **Empty states:** no connection → picker hidden; connected + zero imports → “No projects imported” link to Profile → Connected accounts
- **Sync:** `project_names_synced_at` on `asana_connections`; entry-row “Synced … / Refresh” calls `syncImportedAsanaProjectNames`

#### Item 2 — Dashboard connect toast
- `AsanaConnectBanner` on `/app/dashboard` when user has `org_id` but no `asana_connections` row
- CTA → `/app/profile#section-connected`; per-session dismiss (reappears on next load if still disconnected)

#### Item 3 — Asana branding
- Official three-pebble mark: `src/components/icons/AsanaIcon.tsx` (Asana brand coral `#F06A6A`)
- Used in Connected Accounts, entry picker, dashboard banner, Import projects modal

#### Item 4 — Proactive reconnect notification
- **Approach:** opportunistic check on dashboard load (`AsanaConnectionHealthCheck` → `checkAsanaConnectionHealth`); no new cron/edge infrastructure
- Attempts `getValidAsanaAccessToken()`; on failure inserts one unread `asana_reconnect_required` notification (deduped while unread)
- Bell navigates to `/app/profile#section-connected`

#### Key files
- `supabase/migrations/20260622000000_time_entry_asana_project.sql`
- `src/components/icons/AsanaIcon.tsx`, `src/components/asana/*`
- `src/app/app/timesheets/TimeEntryRow.tsx`, `TimeTrackingView.tsx`, `time-entry-client.ts`
- `src/lib/time/get-time-tracking-data.ts`, `src/app/app/profile/asana-actions.ts`
- `src/app/app/dashboard/page.tsx`, `src/lib/notifications.ts`, `NotificationsBell.tsx`

#### Manual step required
Run `supabase/migrations/20260622000000_time_entry_asana_project.sql` in Supabase SQL editor before testing entry picker in production.

### Session — Asana picker reorg, fixes, polish ✅

#### Verify baseline
- Commit `74af97b` on `main` — Asana entry picker, connect banner, branding, reconnect notifications
- Migration `20260622000000_time_entry_asana_project.sql` — owner must confirm applied on prod (`time_entries.asana_project_id`, `asana_connections.project_names_synced_at`)

#### Item 1 — Asana project picker reorg
- `AsanaProjectPicker` moved to **leading** slot in `TimeEntryRow`; Cadence project dropdown second
- Same prominence as Cadence (`fieldBase` select styling — no coral tint); label **“Asana project”** (not “optional”)
- Grid is single-column when Asana not connected (no empty gap)

#### Item 2 — Dropdown overflow fix
- Native `<select>` replaced with custom listbox in `AsanaProjectPicker` — `max-h-60 overflow-y-auto` on the options panel

#### Item 3 — Connected Accounts anchor scroll
- `ProfileHashScroll` client component on profile page; `scroll-mt-20` on all section cards (clears sticky topbar)
- CTAs already use `/app/profile#section-connected` (banner, picker empty state, notification bell)

#### Item 4 — Bell badge for Asana reconnect
- Unread `asana_reconnect_required` → Asana icon on bell dot (surface + coral border); list items use `AsanaIcon` too

#### Item 5 — Clickable Asana tag → project URL
- **No migration:** `asana_imported_projects.asana_project_gid` already stored
- Collapsed summary tag links to `https://app.asana.com/0/{gid}`; expanded picker shows “Open in Asana” link
- Helper: `src/lib/asana/urls.ts` (`asanaProjectUrl`, `formatAsanaSyncedAt`)

#### Item 6 — Last-synced on collapsed row
- Collapsed summary shows “Synced …” when an Asana project is tagged (uses `asanaProjectNamesSyncedAt`)

#### Item 7 — Empty-state importable count
- When zero imports, picker fetches `listAsanaProjectsForImport` and shows “N available to import”

#### Item 8 — Disconnect confirmation modal
- Already present in `ConnectedAccountsSection` — confirms before revoke + clear imported list

#### Key files
- `src/components/asana/AsanaProjectPicker.tsx`, `src/app/app/timesheets/TimeEntryRow.tsx`
- `src/app/app/profile/ProfileHashScroll.tsx`, `src/app/app/profile/page.tsx`
- `src/components/app/NotificationsBell.tsx`, `src/lib/asana/urls.ts`

### Session — Design system overhaul ✅

Full visual redesign across app shell, all `/app/**` pages, and landing page. **No logic, server actions, database queries, types, or API routes changed** — only CSS variables, Tailwind config, component markup/classNames, and font imports.

#### Tokens (DESIGN.md applied)
- **Light:** parchment `#FBFAF7` background, `#FFFFFF` surface, `#1A1917` ink, warm gold accent `#7F560C` / mid `#C9974A`
- **Dark:** true black `#000000` background, `#0D0D0B` surface, gold accent `#C9974A`
- New vars: `--surface-low`, `--surface-container`, `--accent-mid`, `--shadow-card`, `--shadow-float`, `--radius-card` (12px), `--radius-input` (8px), `--radius-chip`
- Tailwind: `bg-background`, `bg-surface`, `bg-surface-low`, `bg-container`, `text-ink`, `text-muted`, `border-line`, `bg-accent-soft`

#### Typography
- **Space Grotesk** (400–700) → `--font-space` — default `font-sans`, headings, nav, stat numbers
- **Inter** (400–600) → `--font-inter` — body via `globals.css` + `font-body`
- **Playfair Display** (600–700) → `--font-playfair` — landing hero decorative tagline only
- `.tabular` utility for all numeric display

#### Scope
- Primitives: Button, Input, Card, Badge, Table, TimePicker, DatePicker, MotionModal
- App shell: Sidebar (active left-border accent), Topbar (56px), org logo block
- Pages: dashboard, timesheets log/list, employees, leave, documents, profile, settings, audit, projects, trends, onboarding
- Landing: hero Playfair accent, feature cards gold left-border, stats bar, testimonial cards, surface-low footer
- Charts: primary `var(--accent-mid)`, secondary `var(--ink-muted)` via `useChartColors()`

#### Key files
- `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`
- `src/components/ui/{Button,Input,Card,Badge,Table,TimePicker,DatePicker}.tsx`
- `src/components/app/{AppShell,Sidebar,Topbar,NotificationsBell}.tsx`
- `src/components/marketing/LandingPage.tsx`
- `src/components/motion/{MotionCard,MotionModal}.tsx`
- `src/lib/chart-colors.ts`

#### Owner verification (prod)
```sql
-- Confirm migration applied
SELECT column_name FROM information_schema.columns
WHERE table_name = 'time_entries' AND column_name = 'asana_project_id';
SELECT column_name FROM information_schema.columns
WHERE table_name = 'asana_connections' AND column_name = 'project_names_synced_at';
```

### Session — Entry row alignment, collapse behavior, summary fix ✅

#### Item 1 — Asana/Cadence dropdown alignment
- Shared `PROJECT_SELECT_CLASSES` / `PROJECT_LEADING_SLOT` in `AsanaProjectPicker.tsx` — both fields use identical `fieldBase` h-9 styling and chevron treatment
- Sync / "Open in Asana" / Refresh moved to `AsanaProjectPickerMeta` below the grid (no longer inflates Asana cell height)
- Empty-import state uses same h-9 field shell as the Cadence select

#### Item 2 — Collapse only on explicit Save
- `persistEntry(..., { collapse: true })` only from Save button; autosave paths omit `collapse`
- Save button = same persist path + collapse on success (no separate persistence logic)
- Rows loaded from DB still start collapsed (`entryToDraft` unchanged)

#### Item 3 — Collapsed summary precedence
- **Neither** → "No project"
- **Cadence only** → Cadence dot + name
- **Asana only** → Asana icon + name (primary slot; no "No project")
- **Both** → Cadence in primary slot + Asana tag after billable pill
- "Synced …" rendered smaller/muted (`text-[10px] text-muted/80`) relative to Asana tag

#### Key files
- `src/components/asana/AsanaProjectPicker.tsx`, `src/app/app/timesheets/TimeEntryRow.tsx`, `TimeTrackingView.tsx`

### Session — Light polish + dark mode (Stitch reference) ✅

Full visual polish for light mode and complete dark mode implementation. **No logic, server actions, database queries, types, or API routes changed** — only CSS variables, Tailwind config, component markup/classNames, and font imports.

#### PART 1 — Light mode fixes
- **1A Landing hero:** Playfair Display italic tagline as decorative background — absolute, `opacity-10`, `pointer-events-none`, `z-0`, ~96px; headline at `z-10`
- **1B Sidebar:** "PAYROLL & HR" subtitle under wordmark; org logo block at top; bottom org name + role block retained
- **1C Dashboard stat cards:** CAPS labels, 42px tabular numbers, section headings 18px/600; greeting via `PageHeader greeting` prop
- **1D Leave balance cards:** 4-across grid, 48px numbers, progress bar, uppercase labels
- **1E Audit log badges:** Colored pill chips by action type with dark bordered overrides
- **1F Timesheets list:** Employee 14px semibold + org secondary line; tabular hours/totals
- **1G Trends stat cards:** Same dashboard stat treatment, 4-across grid

#### PART 2 — Dark mode (Stitch)
- **2A–2B Tokens + shapes:** `.dark` block — bg `#0A0A08`, gold `#F7BD48`, hairline borders, zero radius/shadows; global shape overrides
- **2C–2K Components:** Nav uppercase labels; button/input/modal/topbar dark treatments; gold stat numbers; table + badge dark styles; chart line-only in dark

#### Key files
- `src/app/globals.css`, `tailwind.config.ts`
- `src/components/ui/{buttonStyles,Input,Badge,Table}.tsx`
- `src/components/app/{Sidebar,Topbar,PageHeader}.tsx`
- `src/components/motion/MotionModal.tsx`
- `src/app/app/dashboard/*`, `leave/LeaveEmployeeView.tsx`, `audit/AuditLogViewer.tsx`
- `src/app/app/timesheets/TimesheetListTable.tsx`, `trends/{TrendsCharts,page}.tsx`
- `src/lib/chart-colors.ts`, `src/components/marketing/LandingPage.tsx`

### Session — Dashboard data, leave calendar, week summary, trends accent, dark dropdown ✅

Five surgical UI + query fixes. No API routes, auth, or unrelated logic changed.

#### Fix 1 — Dashboard stat data + number size
- **`getEmployeeDashboard`** (`src/lib/dashboard/queries.ts`): approved timesheets only (`status = 'approved'`, `employee_id = profile.id`); total earnings sums `calculated_total` across all approved; approved hours this month from `time_entries.total_hours` where parent timesheet `approved_at >=` month start; chart periods use `time_entries` not legacy `timesheet_rows`.
- **`getAdminDashboard`**: org-scoped `profiles.org_id`; optional `orgId: null` aggregates across all orgs (superadmin); month metrics use `approved_at` + `time_entries`.
- **`getSuperadminOrgSummaries`**: approved hours from `time_entries` with `approved_at` month filter.
- **Server log:** `console.log('[dashboard] employee query result', …)` left in for Vercel verification.
- **Stat cards:** `StatCard.tsx` + `CurrencyTotals.tsx` — `text-6xl font-bold tabular` Space Grotesk; `dark:text-[var(--accent)]` on numbers.

#### Fix 2 — Leave calendar compact
- **`LeaveEmployeeView.tsx`**: day cells `min-h-[72px]`, day number `text-[13px] text-muted` top-left; header row `text-[11px] uppercase tracking-wide text-muted py-2`; calendar card `overflow-hidden`; balance cards unchanged above calendar (no min-height forcing scroll-off on ~900px viewport).

#### Fix 3 — Week summary Asana project display
- **`week-stats-client.ts`**: display precedence — Cadence `project_id` primary; Asana-only when no `project_id`; neither → "No project"; `asana_project_name` on slice.
- **`get-time-tracking-data.ts`**: flattens `asana_project_name` onto entries.
- **`TimeTrackingView.tsx`**: week summary shows `AsanaIcon` (16px) for Asana-sourced rows; Cadence color dot / muted dot for none.

#### Fix 4 — Trends stat accent
- **`TrendsCharts.tsx`**: stat number value uses `text-[var(--accent)]` (light + dark); label stays muted uppercase.

#### Fix 5 — Cadence project dropdown dark mode
- **`TimeEntryRow.tsx`**: native `<select>` replaced with `CadenceProjectListbox` (matches Asana picker pattern); panel `dark:bg-[var(--surface-container)]`, options `dark:hover:bg-[var(--surface-low)]`, selected `dark:bg-[var(--accent-soft)] dark:text-[var(--accent)]`, "+ New project" `dark:text-[var(--accent)]`.

#### Owner verification (prod)
- Deploy → open `/app/dashboard` as employee → Vercel logs should show `[dashboard] employee query result` with `approvedHoursMonth` / `earningsByCurrency`.

### Session — Leave unit system + unified project picker ✅

#### Manual step required
Run `supabase/migrations/20260623000000_leave_types_unit.sql` in Supabase SQL editor **before** deploying.

#### Item 1 — Leave unit system (days / hours)
- **Migration:** `leave_types.unit` (`days` | `hours`, default `days`).
- **`src/lib/leave/types.ts`:** `LeaveUnit`, `formatLeaveAmount()`, `formatLeaveRemaining()`.
- **`src/lib/leave/queries.ts`:** balance/request meta includes `leave_type.unit`.
- **`RequestLeaveModal.tsx`:** days mode = date range + half-day; hours mode = single date + hours input; unit-aware summary + balance validation.
- **`actions.ts` `requestLeave`:** branches on leave type unit; stores hours in `days_requested`; error copy uses `formatLeaveRemaining`.
- **`LeaveEmployeeView.tsx`:** balance cards + history table use unit-aware formatting.
- **`LeaveAdminView.tsx`:** pending queue + team balance table show unit-aware amounts.
- **`LeaveTypesTab.tsx`:** Days/Hours segmented control on add form; unit column in table.
- **`leave-actions.ts`:** persists `unit` on create/update.

#### Item 2 — Unified project picker
- **`src/components/time/ProjectPicker.tsx`:** single dropdown — Asana section (when connected + imports) + Cadence projects + “+ New project”; mutual exclusion (`project_id` XOR `asana_project_id`); placeholder “Project”; dark mode tokens.
- **`TimeEntryRow.tsx`:** replaces `AsanaProjectPicker` + `CadenceProjectListbox` with `<ProjectPicker />`; `AsanaProjectPickerMeta` only when Asana project selected.
- **`TimeTrackingView.tsx`:** `onProjectPick` clears the other ID on save.

### Session — Google Calendar integration ✅

#### Manual step required
Run `supabase/migrations/20260624000000_google_calendar.sql` in Supabase SQL editor **before** deploying (or paste the SQL from the migration file).

#### Architecture
- **Per-user OAuth** — each Cadence user connects their own Google account; scope `calendar.readonly`.
- **Entry point:** Profile → **Connected accounts** — side-by-side Asana + Google Calendar tiles; **Manage** opens modals (no inline expansion).
- **OAuth flow:**
  - `GET /api/google-calendar/connect` — httpOnly state cookie, redirects to Google OAuth
  - `GET /api/google-calendar/callback` — exchanges code, fetches user email, encrypts tokens, redirects to `/app/profile?gcal=connected#section-connected`
  - `POST /api/google-calendar/disconnect` — revokes token, clears connection + selected calendars + synced events
- **Token encryption:** AES-256-GCM via `DOCUMENT_ENCRYPTION_KEY`, scrypt salt `cadence-gcal-v1` (`src/lib/google-calendar/crypto.ts`).
- **Token refresh:** `getValidGCalAccessToken()` refreshes when expired or within 5 minutes of expiry.

#### Database
- **`google_calendar_connections`** — per-user OAuth tokens (encrypted), `google_email`, timestamps. RLS: user manages own row.
- **`google_selected_calendars`** — `calendar_id`, `calendar_name`, `is_synced`. Unique `(user_id, calendar_id)`.
- **`google_calendar_events`** — synced events (title, times, organizer, guests jsonb, html_link). Unique `(user_id, google_event_id)`.
- Index: `idx_gcal_events_user_date` on `(user_id, start_at)`.

#### Env vars (Vercel, server-only unless noted)
- `GOOGLE_CLIENT_ID` — Google Cloud OAuth client ID (Calendar API enabled)
- `GOOGLE_CLIENT_SECRET` — OAuth client secret
- `GOOGLE_CALENDAR_REDIRECT_URI` — must match Google console (`…/api/google-calendar/callback`)

#### UI & features
- **Connected accounts:** two-tile grid; `AsanaManageModal` + `GoogleCalendarManageModal`; official multicolor `GoogleCalendarIcon`.
- **Google manage modal:** calendar sync toggles, Sync events button, upcoming events list with per-row refresh, disconnect confirm.
- **Leave calendar:** synced events as blue `#4285F4` pills on day cells when connected + ≥1 `is_synced` calendar; click → `GoogleEventDetailModal`.
- **Log time suggestions:** SSR prefetch `getEventsForDay` per week day; collapsible “From calendar” section with Add button; `?date=&prefill=` from event detail modal.
- **Mobile nav:** sidebar hidden below 768px; full-screen overlay z-50; topbar hamburger + Cadence wordmark center + avatar/bell right.

#### Key files
- `src/lib/google-calendar/{config,crypto,connection,api,sync,errors,prefill}.ts`
- `src/app/api/google-calendar/{connect,callback,disconnect}/route.ts`
- `src/app/app/profile/{google-calendar-actions,AsanaManageModal,GoogleCalendarManageModal}.tsx`
- `src/components/icons/GoogleCalendarIcon.tsx`
- `src/components/google-calendar/GoogleEventDetailModal.tsx`
- Updated: `ConnectedAccountsSection.tsx`, `LeaveEmployeeView.tsx`, `TimeTrackingView.tsx`, `AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`
- `supabase/migrations/20260624000000_google_calendar.sql`

### Session — Modal flicker, overnight auto-detect, overlap skip, delete dialog, mobile stats ✅

Six surgical fixes — no logic outside specified scope.

#### Fix 1 — Modal flickering + scroll (Asana + Google Calendar)
- **`AsanaManageModal.tsx`**, **`GoogleCalendarManageModal.tsx`**, **`AsanaImportModal.tsx`:** fetch guarded with `useRef` so data loads once per open (no re-fetch on parent re-render); Google Calendar `syncAllEvents()` guarded against concurrent calls.
- **`MotionModal.tsx`:** body scroll lock on open; backdrop `fixed inset-0 bg-black/50 z-40`; panel `fixed` centered `z-50`; manage modals use `max-h-[80vh] flex flex-col` + scrollable `overflow-y-auto flex-1` content area.

#### Fix 2 — Overnight shift auto-detect
- **`TimeEntryRow.tsx` / `TimeTrackingView.tsx`:** removed overnight confirmation button/prompt; `end_time < start_time` silently treated as overnight.
- **`time-entry-client.ts`:** `canPersistTimeEntry()` allows overnight pairs; writes `is_overnight: true` when derived from times before save.

#### Fix 3 — Skip overlap check for overnight entries
- **`validation.ts`:** `deriveIsOvernight()` / `shouldSkipOverlapCheck()` helpers.
- **`time-entry-client.ts` + `time-actions.ts`:** client + server overlap validation skipped when entry is overnight.

#### Fix 4 — Delete timesheet dialog
- **`DeleteTimesheetControl.tsx`:** MotionModal with spec styling — Space Grotesk 18px heading, Inter 14px warning copy, Cancel (secondary) + Delete (`bg-red-600`), dark border accent.

#### Fix 5 — Trends + dashboard mobile stat cards
- **`TrendsCharts.tsx`**, **`StatCard.tsx`**, **`CurrencyTotals.tsx`**, **`StatCardGrid.tsx`**, **`EmployeeDashboardContent.tsx`:** responsive stat numbers `text-3xl sm:text-4xl lg:text-6xl`; grids `grid-cols-2 sm:grid-cols-4 gap-3`; cards `min-w-0 overflow-hidden`; labels `text-[10px] sm:text-[11px]`; values truncate.

#### Fix 6 — Connected accounts tiles layout
- **`ConnectedAccountsSection.tsx`:** `grid grid-cols-1 sm:grid-cols-2 gap-4`; tiles `min-w-0`; Manage button inside each tile card.

### Session — App-wide modal flicker fix, profile restructure, overnight fix, dark dropdowns, robustness ✅

Six-part hardening pass. Branch `claude/dreamy-franklin-wlhqld`.

#### Part 1 — App-wide modal flicker (root-cause fix)
- **`globals.css`:** `body.modal-open { overflow: hidden; height: 100% }` (CSS-only lock — no inline `document.body.style.overflow` reflow anywhere in the codebase). Added `scrollbar-gutter: stable` on `html` so locking body scroll never shifts page content sideways (kills the classic scrollbar-width layout jump).
- **`src/lib/body-scroll-lock.ts`:** ref-counted `lockBodyScroll()` / `unlockBodyScroll()` toggling `.modal-open` — stacked/nested modals don't prematurely unlock the body. Used by `MotionModal` + `OfficialDocSignModal`.
- **`MotionModal.tsx` rewrite:** flex centering (`fixed inset-0 z-50 flex items-center justify-center` panel wrapper, `pointer-events-none`; inner panel `pointer-events-auto`) — replaces `top-1/2 left-1/2 -translate-*` which caused sub-pixel blur/shake during the scale animation. Backdrop `fixed inset-0 z-40 bg-black/50`. `AnimatePresence mode="wait"` with two keyed children (backdrop + panel) so both enter/exit animate. Motion props come from `MODAL_BACKDROP`/`MODAL_PANEL` constants (no inline literals). **Architecture note:** `AnimatePresence` is kept *inside* `MotionModal` (the shared primitive encapsulates presence, like Radix/HeadlessUI); call sites render it always-mounted with `open={…}`. Bespoke popups (NotificationsBell, RowActionsMenu, TimePicker, DatePicker, ProjectPicker) already wrap their conditional in `AnimatePresence` at the call site.
- **Inline motion literals extracted to constants:** `NotificationsBell` (`BELL_PANEL_MOTION`, `BELL_ITEM_*`), `TimeEntryRow` (`SAVED_INDICATOR_MOTION`).
- **Bespoke modals fixed:** `OnboardingCell` converted to `MotionModal`; `OfficialDocSignModal` (intentionally full-screen) gets the ref-counted body lock + a `useRef` fetch-once guard + button spinner.
- Confirmed zero `document.body.style` mutations and zero translate-centered modals remain.

#### Part 2 — Profile restructure
- **Connected accounts moved to the very top** of `/app/profile` (above Personal details / Employment / Job details / Banking / Emergency).
- **`AsanaManageModal.tsx` + `GoogleCalendarManageModal.tsx` deleted** — replaced by **inline expandable sub-sections** (`AsanaConnectionPanel.tsx`, `GoogleCalendarConnectionPanel.tsx`) inside the Connected accounts card. Framer Motion `height` expand/collapse (`INLINE_EXPAND` in `motion.ts`) — no z-index, no backdrop. Only one open at a time; Manage ↔ Close.
- **Asana panel:** connection email + date, reconnect (on scope error), imported projects list (`max-h-48 overflow-y-auto`, per-row Remove), Import more (→ `AsanaImportModal`, kept), Sync names, inline Disconnect confirm.
- **Google panel:** real account email + date, calendars-to-sync toggles (`max-h-40`), Sync events + last-synced, upcoming events (`max-h-48`, per-row refresh), inline Disconnect confirm.
- **`InlineDisconnect.tsx`:** shared red-text → "Are you sure? Confirm / Cancel" (no modal).
- **GCal email tile fix:** the tile showed "Connected account" because `google_calendar_connections.google_email` was `null` (the `calendar.readonly` scope never returned it). Fix: added `openid` + `userinfo.email` scopes (future connects), **and** `fetchUserCalendars` now backfills `google_email` from the primary calendar id (the email) for existing connections + `revalidatePath`. So the tile populates after first Manage-open and immediately on reconnect.

#### Part 3 — `is_overnight` write error (regression fix)
- Live `time_entries` has **no `is_overnight` column** (`total_hours` is `GENERATED ALWAYS`). The prior session re-added `is_overnight` to the write payload → `Could not find the 'is_overnight' column … in the schema cache`.
- Removed from all insert/update payloads: `time-entry-client.ts` (build now returns `{ row, overnight }`; overnight stays local for overlap-skip), `time-actions.ts`, and the `time_entries` Row/Insert/Update types in `types/db.ts` (so TS catches future strays). Overnight detection (`end < start`) remains client-side only.

#### Part 4 — Dropdown dark mode
- `globals.css`: `.dark select`, `.dark select option`, `.dark select:focus` → surface tokens (the element selector out-specifies utility classes). Audited custom listboxes (ProjectPicker, TimePicker, DatePicker, RowActionsMenu, AsanaProjectPicker) — all already token-based; the dark `shadow→border` rule keeps panels visible.

#### Part 5 — Robustness
- **error.tsx** added for `/app/dashboard`, `/timesheets`, `/timesheets/log`, `/leave`, `/profile`, `/trends`, `/documents`, `/employees` (shared `RouteError`).
- **Race conditions:** `TimeTrackingView.load()` now guarded by a request-sequence ref (rapid week-switching can't apply a stale response); GCal panel load uses a `cancelled` flag. NotificationsBell poll + EmployeesListRefresh interval already clean up; verified.
- **Stale closures:** confirmed `TimeEntryRow`/`TimeTrackingView` autosave reads current state via refs (`timesheetIdRef`/`orgIdRef`/`employeeIdRef`/`entriesByDayRef`).
- **Empty states:** added to `TrendsCharts` (employee + admin "no trend data yet"). Verified existing empty states on dashboard, documents, employees, leave, audit, projects, notifications.
- typecheck + build clean (0 errors; only pre-existing `<img>` LCP warnings).

#### Part 6 — Delete timesheet dialog
- `DeleteTimesheetControl` now centers correctly via the rewritten `MotionModal` (was floating). Spec styling already present (Space Grotesk 600/18px heading, Inter body, red `bg-red-600` Delete); simplified redundant `panelClassName`.

#### Key files
- `src/lib/body-scroll-lock.ts`, `src/components/motion/MotionModal.tsx`, `src/lib/motion.ts`
- `src/app/app/profile/{ConnectedAccountsSection,AsanaConnectionPanel,GoogleCalendarConnectionPanel,InlineDisconnect}.tsx`, `page.tsx`, `google-calendar-actions.ts`, `src/lib/google-calendar/config.ts`
- `src/lib/time/time-entry-client.ts`, `src/app/app/timesheets/time-actions.ts`, `src/types/db.ts`
- `src/app/globals.css`, `src/app/app/trends/TrendsCharts.tsx`
- `src/app/app/{dashboard,timesheets,timesheets/log,leave,profile,trends,documents,employees}/error.tsx`
- `src/app/app/employees/OnboardingCell.tsx`, `src/components/official-docs/OfficialDocSignModal.tsx`, `src/components/app/NotificationsBell.tsx`, `src/app/app/timesheets/TimeEntryRow.tsx`

#### Owner notes
- **Branch:** pushed to `claude/dreamy-franklin-wlhqld` (per branch policy — not directly to `main`). Promote/merge as desired.
- **Google Calendar reconnect (optional):** existing connections get their email backfilled on first Manage-open. For email-at-connect on *new* sign-ins, no action needed (scopes added). No migration required this session.

### Session — Modal flicker ROOT CAUSE (portal), overnight duration formula, trends client-side filters ✅

Branch `claude/dreamy-franklin-wlhqld`. Three items; Item 1 was misdiagnosed twice before.

#### Item 1 — Modal flicker + off-center (ACTUAL root cause this time)
- **Diagnosis:** `position: fixed` modals render *inside* `PageTransition`'s `<motion.div {...PAGE_TRANSITION}>` (`AppShell.tsx`), and `PAGE_TRANSITION` animates `y` → a `transform`. Per CSS, a transformed ancestor becomes the **containing block for `fixed`** descendants, so the backdrop/panel resolved against the **main-content box** (offset by sidebar, only as tall as content) — not the viewport. → off-center, partial dimming; and when hovering re-rendered the subtree, Framer re-applied/cleared the transform so the fixed children's containing block flipped → **flicker**. The prior flex-centering rewrite couldn't fix an *ancestor* problem. (`RowActionsMenu` already portals for this exact reason.)
- **Secondary:** `max-w` from `panelClassName` was applied to the inner block div, not the centered flex child → left-aligned even when viewport-relative.
- **Fix:** `MotionModal` now `createPortal`s to `document.body` (escapes all transformed ancestors → `fixed` is viewport-relative), and collapses to a **single flex child** carrying the width constraint so `justify-center` works. z bumped to `z-[100]/[101]`. `OfficialDocSignModal` (bespoke full-screen) also portaled. Notifications bell / time+date pickers were never affected (topbar-based / `absolute`, not `fixed`).

#### Item 2 — Overnight duration formula (wrong sign + magnitude)
- **Diagnosis:** live `time_entries.total_hours` is `GENERATED ALWAYS AS (end - start)/3600` → **negative** for overnight (23:30→00:15 = −23.25h). The app read this DB value directly. The pure formula `hoursBetween` already wraps correctly; nothing used it for persisted rows.
- **Fix (client-side, no DB change, no `is_overnight`):** new `durationHours(start,end)` in `validation.ts` (wraps when end ≤ start). Every consumer now recomputes instead of reading the generated column:
  - Log view: `saveTimeEntryClient` returns computed hours; `TimeTrackingView.entryToDraft` recomputes → fixes row chip, week TOTAL, by-project, billable split, submit progress.
  - Server submit gate: `week-stats.ts computeWeekStats`.
  - Detail page `[id]/page.tsx` (per-row + total). Approval pay: `actions.ts totalHoursForTimesheet` → correct `calculated_total`.
  - Dashboard `queries.ts` + Trends `trends.ts` (wrapped once at the data-loading boundary) + SSR `week-stats-from-entries.ts`.
  - Verified: 23:30→00:15 = 0.75h, 22:00→02:00 = 4.0h, 09:00→17:00 = 8h. (CSV export reads legacy `timesheet_rows.hours`, unaffected.)

#### Item 3 — Trends filters caused full reload
- **Diagnosis:** range filter used a raw `<a href="?range=…">` → full document reload; superadmin org select navigated via router.
- **Fix:** new `getTrendsBundle()` (shared server lib), `fetchTrendsData()` server action, and `TrendsClient.tsx` client component holding `range`/`org` state — filter changes call the action and update charts **in place** (dim during `useTransition`, `history.replaceState` keeps the URL shareable, no navigation). Range pills are now `<button>`s; org is a native dark-mode `<select>`.

#### Key files
- `src/components/motion/MotionModal.tsx`, `src/components/official-docs/OfficialDocSignModal.tsx`
- `src/lib/time/validation.ts` (`durationHours`), `time-entry-client.ts`, `week-stats.ts`, `week-stats-from-entries.ts`, `trends.ts`
- `src/app/app/timesheets/TimeTrackingView.tsx`, `[id]/page.tsx`, `actions.ts`; `src/lib/dashboard/queries.ts`
- `src/app/app/trends/{page.tsx,TrendsClient.tsx,trends-actions.ts}`

#### Owner test checklist
1. Open Delete dialog from a timesheet row → **centered**, full-screen dim, no shake; move cursor over dimmed area → **no flicker**. Repeat for onboarding modal + official-doc sign.
2. Log `23:30–00:15` → **0.75h** on the row, week TOTAL, by-project, billable, submit progress. Log `22:00–02:00` → **4.0h**.
3. `/trends`: click Weekly/Fortnightly/Monthly/6 months/Yearly and (superadmin) switch Organization → charts update **in place**, no full-page reload/flash.

#### Notes / not changed
- Kept client-side per instruction (no DB migration; `total_hours` stays generated; `is_overnight` not reintroduced).
- Branch was pushed to `claude/dreamy-franklin-wlhqld`. **Since merged (fast-forwarded) into `main`** — see "Modal flicker RESOLVED + anchored to `main`" below.

### Session — Modal flicker RESOLVED + anchored to `main`, build marker, branch reconciliation ✅

**Status: the app-wide modal flicker + off-center dialog is RESOLVED.** The owner re-tested the live production deploy (`cadence-eta-five.vercel.app`, commit `097d991`): modal is centered, backdrop dims evenly, no flicker on pointer-move over the backdrop, no scroll/hover flicker. No further `MotionModal` changes were needed — this session was **reconciliation + deploy-verifiability only** (no reproduction, no modal code change).

#### Root cause (confirmed, for the record)
`position: fixed` modals were rendering *inside* `PageTransition`'s `<motion.div {...PAGE_TRANSITION}>` (animates `y` → a `transform`). A transformed ancestor becomes the **containing block** for `fixed` descendants, so the backdrop/panel resolved against the main-content box (offset by the sidebar, only as tall as content) instead of the viewport → off-center + partial dimming; a re-render/hover toggled the transform → the containing block flipped → flicker. **Fix = `createPortal` to `document.body`** (escapes every transformed ancestor → `fixed` is viewport-relative) + a single flex-centered child carrying the width constraint + ref-counted CSS body-scroll-lock (`.modal-open` + `scrollbar-gutter: stable`, no inline `body.style.overflow` reflow). Shipped in `097d991` (built on `b9d0135` / `e56da56`).

#### Why the two prior "attempts" looked like failures (they weren't)
They were **not** code-only failures and were **not** un-deployed. They shipped to production on branch `claude/dreamy-franklin-wlhqld` (portal commit `097d991` promoted 2026-06-13 22:07 UTC, ~20 h before the bug was re-reported). The confusion was **git topology**, not code: the fix branch was **never merged to `main`**, and `main` — plus a throwaway branch `claude/sweet-mayer-d9xc4n` cut from it — still carried the OLD broken `fd622a9` modal (translate-centering + inline `body.style.overflow`). Reading *those* branches' `MotionModal.tsx` showed "no portal / no flex-centering," which read as "the fix never shipped" — but production was always serving the portal fix. The earlier `data-build` gap is exactly why the build marker (below) now exists.

#### Anchored to `main` (this session)
- `claude/dreamy-franklin-wlhqld` (`097d991`) was **fast-forwarded into `main`**. `097d991` is now an ancestor of `main`, so `main` no longer carries the broken modal. This removes the hazard where a future push to `main` would auto-deploy a production **regression** of the modal fix.
- A build-marker commit sits on top of the fast-forward (below).

#### Build marker — verify which commit is actually live
- `next.config.mjs` exposes `VERCEL_GIT_COMMIT_SHA` as `NEXT_PUBLIC_COMMIT_SHA`; `src/app/layout.tsx` renders it on `<body data-build="…">`.
- Confirm what is serving in production:
  ```bash
  curl -s https://cadence-eta-five.vercel.app | grep -o 'data-build="[^"]*"'
  ```
  Compare against `git rev-parse origin/main`. If they match, the live site is the merged `main`. (This is the check that would have instantly resolved the "did the fix ship?" question this session.)

#### Stale branch — DO NOT promote
- `claude/sweet-mayer-d9xc4n` is rooted at the old `fd622a9` (broken modal) and was **not** merged anywhere. Discard / ignore it — promoting it would regress the modal fix.

### Security audit (read-only) — findings only, fixes pending triage

Ran a read-only, evidence-first security audit against **`main` @ `acef7f3`** and the **live production DB** (Supabase project ref `irybkcryeywmwpcmhlaa`, read via MCP — live policies/grants/triggers, not migration files). **No app code, RLS, or config was changed.** This is an inventory, **not** a security clearance — nothing here is marked "secure".

Full report: **`SECURITY_AUDIT.md`** (repo root) — severity-ranked table, per-table cross-tenant matrix, full `createAdminClient` call-site inventory, "what's solid" calibration, and the headline verdict.

**Headline:** multi-tenant isolation does **not** fully hold — two 🔴 Critical gaps, both at the DB/storage policy layer (app code is disciplined):
- **C1** — `profiles` UPDATE policy `with check (id = auth.uid())` + `authenticated` column-UPDATE on `role`/`org_id`/`status` + no trigger → any signed-in user can self-promote to `superadmin` or re-point their own `org_id` from the browser.
- **C2/H1** — `timesheets` storage bucket has legacy `ts_read`/`ts_upload` policies scoped only to `auth.role()='authenticated'` (OR'd permissively with the scoped ones) → any authenticated user (incl. `org_id=NULL`) can read/write any org's payroll files. (Live/migration divergence.)
- Plus 🟡 M1 (`audit_log` forgeable inserts), 🟡 M2 (`timesheet_rows` intra-org over-exposure), 🔵 L1/L2 (over-broad `anon` grants; caller-trusted `orgId` in service-role aggregators).

**Solid:** RLS on all 21 tables; `auth_org()`/`auth_role()`/`is_active()` unspoofable; standard tenant tables org-pinned on read+write; token tables own-user-only; every `createAdminClient` site derives tenant key server-side (no client `org_id` trusted); service-role + encryption keys server-only; secrets never returned to client; other storage buckets path-scoped. **Fixes deferred to separate triage — do not action from this entry; see `SECURITY_AUDIT.md`.**

## Deferred (do not build yet)
- Full employee account deletion / GDPR hard-delete (membership removal only ships this session)
- FX conversion layer (cross-currency summing)
- CFO Claude Agent webhook activation (seam exists, just dormant)
- DOCX → PDF server-side conversion on Vercel (DOCX shows download + acknowledge flow)

## Track C — single-org-per-user → TRUE multi-workspace ✅ (branch `track-c-multiworkspace`)

> **Superseded (2026-07-06):** Merged to `main` and deployed 2026-06-15 @ `d40fab4`. Post-deploy isolation 30/30 passed. Section below is historical record.


**The model change.** Cadence went from "a user IS their org" (`profiles.org_id` ties one user to one org; `auth_org()` reads it) to **personal-by-default + many-to-many memberships + a server-side active workspace**. Every user is a personal account (full solo product minus approvals); orgs are joined via a `memberships` table; the active workspace decides personal-vs-org context and drives both UI and RLS. Self-serve org creation; invite-only joining; **domain auto-attach removed**. Superadmin is platform oversight, outside the workspace structure.

All four stages were applied **live** to `irybkcryeywmwpcmhlaa` via Supabase MCP (shared prod+preview DB — there is no separate branch DB), each committed with its migration file + pushed to the branch (preview deploys; `deploy_to_vercel` never called; never pushed to `main`).

### New DB objects
- **`memberships`** (`user_id`, `org_id`, `role` owner/admin/employee, unique(user_id,org_id)). RLS: read own + superadmin read. **No client write path** — written only by SECURITY DEFINER RPCs / service role.
- **`active_workspace`** (`user_id` PK → `org_id`). Read-own RLS; written only via `set_active_workspace()`.
- **`track_c_org_link_archive`** (table_name, row_id, original_org_id) — **87 severed org links** recorded at the C2 cutover for reversibility/forensics (superadmin-read only).
- **Helpers:** `auth_org()` REWRITTEN to resolve `active_workspace ⨝ memberships` (forged/stale active-workspace for a non-member org → NULL → personal/no access); `auth_workspace_role()` (org role from memberships); `my_org_ids()`, `active_org_member_ids()`; RPCs `set_active_workspace(org)`, `create_organization(name,…)`, `accept_invite(invite_id)`, `pending_invites_for_me()`. `auth_role()` now only used for the `superadmin` platform check; `is_active()` unchanged.

### Stages
- **C1** `20260627000000_track_c1_memberships_personal_scope.sql` — additive: memberships table, `org_id` widened to NULLABLE on 11 personal-capable tenant tables, `create_organization()`. Live app untouched (helpers/data unchanged).
- **C2** `20260628000000_track_c2_atomic_cutover_rls_rewrite.sql` (HIGHEST RISK) — atomic cutover (all 11 beta users → personal-only; `org_id` severed on owned rows, archived, **no row deleted**; superadmin preserved; old orgs Voxility/Google left inert; memberships stays 0) + `auth_org()` rewrite + **every tenant policy rewritten** for personal/active-org/superadmin scope. Preserved C1/C2/H1 fixes (profiles guard trigger + scoped timesheets storage). Also CLOSED **M1** (dropped forgeable `audit_log` insert) and **M2** (scoped `timesheet_rows` by parent owner). **Isolation gate: 44/44 in-rollback + 22/22 committed-live, 0 failures.**
- **C3** (no migration) — `getWorkspaceContext()` returns an **effective profile** (`org_id`+`role` re-pointed at the active workspace) so existing role/org-scoped code follows the switcher and agrees with RLS; `getProfile()` returns it. **WorkspaceSwitcher** in the sidebar replaces the old duplicate org display (one control: current context + access level; switch personal↔orgs; "Create organization"). Context-aware nav (personal/employee/manager/superadmin) + dashboard (solo / team / oversight). Org member listings read `memberships`.
- **C4** `20260629000000_track_c4_invite_accept_rpcs.sql` — `accept_invite()` + `pending_invites_for_me()`; **domain auto-attach removed** from `onboarding.ts` (the only such path); invite redemption now creates memberships; `inviteMember` authorizes via the active workspace's true owner/admin role; switcher surfaces pending invites with one-click Accept. Membership-write paths are now exactly two (`create_organization`, `accept_invite`) — no self-grant.

### Final isolation re-verification (real `authenticated` via `SET ROLE` + injected `request.jwt.claims`, all in `ROLLBACK`) — **24/24, 0 failures** on the finished branch:
a personal cannot read/write any org · b member reads/writes own active org (+storage) · c cross-org read/write denied (tables AND storage) · d escalation refused (`set_active` non-member) + forged active-workspace → NULL · e fresh 0-membership user reaches nothing · f superadmin cross-tenant oversight intact · g profiles privileged-column guard (C1) holds · h every migrated user still reads their own personal data; +C4 bogus `accept_invite` blocked. Plus create-org→switch→owner and invite→accept→membership verified live (rolled back).

### Prod survival
Prod still runs app code `8dfa2f2` (pre-Track-C) on the new DB. It **degrades gracefully to personal-only**: `auth_org()` returns NULL (not an error), existing users read/write their own now-personal data; org/admin views render empty but don't crash. The new model fully lights up when the branch is merged to `main` + deployed (owner does this manually after preview testing).

### Known follow-ups
- ✅ DONE (finalization) — Employees role-change + remove now write `memberships` (not the vestigial `profiles`).
- ✅ DONE (finalization) — `src/types/db.ts` regenerated (memberships/active_workspace/RPCs typed; all `as any` removed).
- Leave approval RPCs (`approve/reject_leave_request`) check `auth_role()` (vestigial) rather than `auth_workspace_role()` — dormant (no org leave yet); a code comment marks the rework needed when org leave lands.
- Personal storage paths (own existing timesheet files in personal context) — define a personal path convention in a follow-up; cross-tenant storage isolation already holds.
- `/login` copy still says "matching email domains join your team automatically" — the mechanism is removed (invite-only); update the copy.
- `allowed_domains` is retained as data only (no auto-attach); could power an optional domain-as-request-to-join later.

### Finalization — MERGED TO MAIN + DEPLOYED TO PRODUCTION ✅ (2026-06-15, `main` @ `d40fab4`)
- **Step 1 follow-ups (on the branch):** (1a) role-change + remove rewritten onto `memberships` (`authorizeTarget()` membership-aware; hierarchy preserved — owner manages admins+employees, manager only employees, nobody touches self/owners/superadmins; writes via service-role admin client, no client write policy on `memberships`). (1b) `db.ts` regenerated + zero `as any`. (1c) leave-RPC dormant comment. (1d) personal storage path = future (cross-tenant storage isolation already holds).
- **Merge:** `main` was actually at production's `8dfa2f2` (the local `c452030` ref was stale), so the merge was a clean **fast-forward `8dfa2f2 → d40fab4`**. `main` now carries the full app + Track C + the C1/C2/H1 security fixes + every migration.
- **Deploy:** pushing `main` auto-created a production deployment that **auto-promoted** (alias includes `cadence-eta-five.vercel.app`). Live `<body data-build>` = `d40fab4` (authenticated fetch). No `deploy_to_vercel`; no manual promotion needed.
- **Drift cleanup:** before deploy, old prod code's domain auto-attach had re-attached ONLY the superadmin (1 profile + 1 timesheet) to Voxility; re-severed precisely → 0 org-attached, all 11 personal, superadmin `org_id` null, no data lost (te 4, ts 5). New code prevents recurrence.
- **Live post-deploy isolation battery: 30/30, 0 failures** on the production DB (a–h + C4 abuse + membership-write safety: authenticated self-grant / own-role-change / delete-other / fresh-self-grant all DENIED).
- **Known infra limitation (out of scope, NOT fixed):** preview-deploy Google OAuth redirects to the production URL (Supabase/Vercel redirect config). Don't change redirect config without owner sign-off.

## Working preferences
- Direct, snappy, concise. Minimal preamble.
- For each build phase: manual actions FIRST (numbered), then the agent prompt.
- Spell out env vars relative to Vercel + Supabase; give SQL explicitly.
- When producing specs/prompts/SQL — no direct code unless asked.
- Don't mention brand/agency names in outputs unless brought up.

## Current state (2026-06-16) — historical

> **Superseded (2026-07-06):** See **Current state (2026-07-06)** at top of this file.


### Personal time logging restored ✅ (app-layer only; no DB change)
- **Problem:** After Track C, `profiles.org_id` is NULL for everyone by default. The app still gated time logging on `profile.org_id`, so the wizard and "Log my time" button disappeared for all personal users.
- **Fix:** Removed app-layer `org_id` gates on the logging path. Org context for writes now comes from the **active workspace** (`requireActiveProfile()` → `getWorkspaceContext().effectiveProfile.org_id`, which mirrors `auth_org()`). Personal workspace → `org_id = null` on new timesheets/entries; org workspace → that org's id. Submit-for-approval UI and server action are hidden/refused for personal (`org_id IS NULL`) timesheets; org-context approval + admin notify unchanged.
- **Touched:** `src/app/app/timesheets/page.tsx`, `TimeTrackingView.tsx`, `time-actions.ts`, `src/lib/time/get-time-tracking-data.ts`, `src/lib/time/time-entry-client.ts`, `src/app/app/timesheets/log/page.tsx`, `fetchProjectsForTimeEntry` / `createProject` (personal projects).
- **Notifications:** `notifications.org_id` is nullable in DB (Track C1). `checkTimeLogReminder` now runs for personal users too (`org_id: null` via service-role insert).

### Resolved bugs / feedback
- ~~**Timesheets: lost ability to log time**~~ — fixed 2026-06-16 (see above).
- ~~**Employees: Unassigned/empty/wrong list, can't self-assign to org**~~ — fixed 2026-06-16 (see below).
- ~~**Workspace switcher changes UI but not context**~~ — fixed 2026-06-16 (see below).
- ~~**Profile: start date locked + "set by your administrator" copy**~~ — fixed 2026-06-16 (see below).
- ~~**Projects: "Select an organisation" gate / pre-Track-C overhaul**~~ — fixed 2026-06-16 (see below).

### Open bugs / feedback
_(none logged)_

### Profile start date + personal-context copy + header identity ✅ (2026-06-16, app-layer only; no DB change)
- **Start date double-lock removed:** `ProfileEmploymentForm` no longer disables the DatePicker once set; `updateOwnEmployment` no longer guards with `!profile.start_date` — users can set, change, or clear `start_date`.
- **Admin copy softened:** Profile page uses `getWorkspaceContext().activeOrgId` for org vs personal context. PageHeader + Employment card administrator wording only when in an org workspace; personal users see neutral copy. Role/Status remain display-only; email stays read-only.
- **Top-right identity:** `Topbar` shows name + email stacked (avatar + text on `sm+`), linked to `/app/profile`; Sign out unchanged.

### Projects rebuild — workspace-scoped + premium wizard ✅ (2026-06-16, app-layer only; no DB change)
- **Removed:** superadmin org-picker (`SuperadminOrgSelect`), `requiresOrgSelection`, all `profiles.org_id` reads on the projects path, card-grid layout, inline create form, `window.location.reload()`.
- **Model:** Context from `getWorkspaceContext()` / active workspace. Personal → `org_id=null, owner_id=user, is_org_wide=false`. Org owner/admin → `org_id=active org, is_org_wide=true`. Org employee → no create (action rejects). Superadmin behaves as personal user.
- **New fields wired:** `description`, `client_name`, `billable_default` (default true) in create/edit modal + list rows.
- **UI:** Single-panel `ProjectFormModal` (create + edit), list-row layout with Org/Personal tags, `router.refresh()` after mutations.
- **Time entry:** Picking a Cadence project seeds `billable` from `billable_default` when `billableTouched` is false; explicit user toggle preserved.

### Workspace switcher persistence + org cap + audit ✅ (2026-06-16, app-layer only; no DB change)
- **Root cause (verified against live prod):** `WorkspaceSwitcher` called `switchWorkspace()` inside `startTransition(() => { void switchWorkspace(orgId) })`, which **discarded the promise** — RPC failures (`not authenticated`, `not a member`, etc.) were never surfaced, and `redirect()` inside the action did not reliably refresh the app shell. The dropdown closed and looked successful, but `active_workspace` stayed empty and `auth_org()` kept returning null (personal). The action already used the authenticated server client (not service-role); the bug was **silent failure + no post-switch revalidation**, not the wrong Supabase client.
- **Fix:** `workspace/actions.ts` — explicit `authenticatedClient()` (`getUser()` before RPC), `persistActiveWorkspace()` with read-back verification, `ActionResult` returns (errors to toast), broad `revalidatePath` across `/app/**`. Client awaits the action, toasts errors, then `router.refresh()` + `router.push('/app/dashboard')` for a full Slack-style context switch.
- **Create org:** `useFormStatus` debounce on submit; hide "Create organization" when non-superadmin already has an `owner` membership; surface DB cap `'You already own an organization'`; auto-switch + `org.create` audit via `writeAudit`.
- **Audit:** Org Audit page scoped via active workspace (`profile.org_id` from `getWorkspaceContext`); `fetchAuditActors` reads org members from `memberships` (not vestigial `profiles.org_id`). Member invite/role/remove audits already present.
- **Cleanup:** Deleted dead `assign-actions.ts` + `AssignMemberModal.tsx` (old `profiles.org_id` assign path).
- **DB note:** One-owned-org cap is **live in production** (`create_organization` raises if non-superadmin already owns an org) — no migration in this pass.

### Employees + workspace self-onboarding restored ✅ (2026-06-16, app-layer only; no DB change)
- **Reconciliation (code vs live UI):** `setRole` / `removeMemberFromOrg` / `inviteMember` were already rewritten onto `memberships` + active workspace. The **page UI was stale**: superadmin still rendered the old global HR table with `profiles.org_id` "Unassigned" column and **Assign to org** (`assign-actions.ts` writing dead `profiles.org_id`). Workspace switcher + `create_organization` RPC were wired in `WorkspaceSwitcher` / `workspace/actions.ts` but unusable for superadmins (create hidden) and produced **zero memberships** when orgs were created via the superadmin **Organizations** page (`organizations/actions.ts` direct `organizations` insert — platform provisioning, no membership).
- **Fix A — workspace:** Personal switch confirmed: `set_active_workspace(NULL)` deletes `active_workspace` (RPC already supported null; types allow `p_org_id: string | null`). Org create via sidebar → `create_organization` → `set_active_workspace(orgId)`. Switcher lists only caller's `memberships` + Personal.
- **Fix B — Employees split:** Superadmin → `PlatformMembersAudit` (id, name, email, emergency_phone, audit link; no banking/rate/assign). Owner/manager in active org → `OrgTeamView` (memberships join; role/remove on `memberships`). Nav: superadmin label **Members**; employees hidden in personal/employee contexts (unchanged).
- **Orphan orgs (needs owner SQL):** The 2 existing orgs created via superadmin Organizations page have **no `memberships` rows** (table still at 0 until someone uses sidebar create or accepts an invite). They cannot be claimed through app flows without a new RPC — **not auto-granted**. Owner must attach memberships via SQL or recreate via workspace switcher.

### Session — Global density + polish pass (Stripe/Vercel-light) + 3 targeted visual fixes ✅ (2026-06-16, app-layer only; no DB change)
- **Central design-system tighten (shared primitives/tokens):**
  - `src/app/globals.css`: lighter `--line`, softer/smaller `--shadow-card` + `--shadow-float`, slightly smaller `--radius-card` / `--radius-input`.
  - `src/components/ui/Card.tsx`: compact default spacing/title scale via shared density vars, explicit hairline border, and lighter card feel; added `density="comfortable"` variant.
  - `src/components/app/PageHeader.tsx`: reduced header spacing and title scale (including greeting mode) for less oversized section headers.
  - `src/components/ui/{Input,Select,Table}.tsx`: denser form/control/table row spacing.
  - `src/components/motion/MotionCard.tsx`: aligned visual surface (border + compact tokenized spacing defaults) with the new shared card system.
- **Dashboard/Trends exception (kept breathable):**
  - `src/app/app/dashboard/{page,AdminDashboardView,EmployeeDashboardContent,StatCard}.tsx`
  - `src/app/app/trends/{TrendsCharts,TrendsClient}.tsx`
  - These views explicitly opt into comfortable card density so charts/stats retain room while the rest of the app gets the compact pass.
- **Targeted visual fix 1 — Project color row (`ProjectFormModal.tsx`):**
  - Removed the near-duplicate preset swatch (`PROJECT_PRESET_COLORS` now distinct set).
  - Replaced the final swatch position with a live custom color picker (`input[type=color]`) wired to `form.color` (still validates as `#RRGGBB` in existing server actions).
- **Targeted visual fix 2 — Billable toggle alignment (`ProjectFormModal.tsx`):**
  - Reworked switch thumb positioning to the same clean `h-6 w-11` track + absolutely-positioned `h-5 w-5` thumb pattern used in Google Calendar toggles (`left-0.5` / `left-[22px]`), fixing misalignment and transition.
- **Targeted visual fix 3 — Time-entry project picker label (`ProjectPicker.tsx`):**
  - Removed `[Org]` prefix from selected label and dropdown option rendering; picker now shows plain project names.

### Session — Workspace switcher refresh + trends relocation (personal→Dashboard, org→standalone) ✅ (2026-06-16, app-layer only; no DB change)
- **Workspace switcher visual refresh (`WorkspaceSwitcher.tsx`)**
  - Restyled to a denser GoHighLevel-like list: compact initial-letter badges (no large `OrgLogo` row blocks), bold workspace name, muted secondary line (role / personal description), crisp row dividers, and a subtle active indicator.
  - No search input added.
  - **Logic unchanged**: existing `switchWorkspace`, `createOrganizationAction`, and `acceptInvite` paths are preserved; memberships/invite data source unchanged.
- **Trends relocation by active workspace context**
  - `nav.ts`: removed `/app/trends` from **personal** nav context only.
  - `trends/page.tsx`: now gates via `getWorkspaceContext()` and redirects personal context (`ctx.isPersonal`) to `/app/dashboard` (route safety for old bookmarks).
  - `dashboard/page.tsx` + `EmployeeDashboardContent.tsx`: personal context now folds in trends as a Dashboard section using existing `EmployeeTrendsView` (no chart rebuild).
  - Org contexts (employee/manager/superadmin org views) keep standalone Trends page behavior.
- **Workspace-scoped personal trend data**
  - `lib/time/trends.ts` employee-trend query now scopes to the active workspace (`org_id = active org` or `org_id IS NULL` in personal context), preventing cross-context mixing.
- **Verification**
  - `npm run typecheck` and `npm run build` pass.
  - Dashboard/Trends comfortable spacing remains intact from the previous comfortable-density overrides.

### Session — Leave rebuild (workspace-scoped, two-mode, GCal push) ✅ (2026-06-16, app-layer + types only; **DB migration needed** — see gaps below)

#### Model
- **Personal workspace:** standalone time-off calendar — mark days off (date/range, half-day, optional note). No org gate, no balances, no categories, no approval. Entries: `org_id = null`, `employee_id = user`, `leave_type_id = null`, `status = approved`.
- **Org workspace:** same calendar + request flow. Category optional when org has leave types (zero types = still works). No balance gating. Pending → owner/admin approve/reject via `auth_workspace_role()` (not global `profiles.role`). Audit on org request/approve/reject/cancel.
- **Context:** `getWorkspaceContext()` / active workspace only — removed all `profiles.org_id` reads on the leave path.

#### Google Calendar (one-way Cadence → GCal)
- On personal mark or org approval, best-effort all-day event in user's primary calendar (`Leave — {note/category/Time off}`).
- Added `calendar.events` OAuth scope (existing connections need reconnect for push).
- Push failure never blocks leave save; soft warning in toast when push fails.
- **Gap — no `google_event_id` column on `leave_requests`:** create-on-confirm only; cancel-on-delete not implemented. Needs migration: `leave_requests.google_event_id text null` (+ optional `google_calendar_id`) to track pushed events for deletion.

#### Schema gap — `leave_type_id` nullability
- App now inserts `leave_type_id = null` for personal leave and uncategorized org requests.
- **Production DB still has `leave_type_id uuid NOT NULL`** (Phase 5 migration). **Needs migration:** `alter table leave_requests alter column leave_type_id drop not null;` — run before personal/uncategorized leave will persist.

#### Touched
- `src/app/app/leave/{page,actions,LeaveEmployeeView,LeaveAdminView,RequestLeaveModal}.tsx`
- `src/lib/leave/queries.ts`
- `src/lib/google-calendar/{config,api,push-leave}.ts`
- `src/types/db.ts` (nullable `leave_type_id` / `org_id` on leave_requests types)
- `src/app/app/timesheets/[id]/page.tsx` (workspace-scoped approved-leave notice)
- `README.md`

#### Removed / deprecated on leave path
- "No organization assigned" empty state, superadmin org picker (`LeaveOrgSelect` unused), balance cards, team balances table, GCal event chips on leave calendar, balance validation in request flow, vestigial `approve_leave_request` / `reject_leave_request` RPC calls (replaced with direct updates + workspace manager gate).

### Session — User document library + org assignment ✅ (2026-06-16, app-layer only; DB `user_documents` + RLS already applied)

#### Model (`user_documents`)
- **Personal upload:** `owner_id` = self, `org_id` null, `source` = `personal`, `uploaded_by` = self. Available in **Personal** workspace (Official documents tab).
- **Org-assigned:** owner/admin in active org uploads + picks target member → `owner_id` = target, `org_id` = active org, `source` = `org_assigned`, `uploaded_by` = admin. Appears in target's library; read-only to recipient (no delete).
- Library list: all rows where `owner_id` = current user (personal + received org-assigned).
- **Generated pay docs untouched:** "Pay advices & invoices" tab, `documents` table, `generate.tsx` unchanged.

#### Storage
- Reuses private `documents` bucket; user uploads at `user-docs/{owner_id}/{uuid}-{filename}` (generated pay PDFs keep `{org_id}/{employee_id}/…` scheme).
- Upload via service-role admin client; signed URLs for download (1h). Rollback: storage upload first → row insert; on insert failure, remove uploaded object.

#### UI
- Official documents tab rebuilt → `UserDocumentsLibrary` (title, file, Personal/Org-assigned badge, date, download; delete personal only).
- Personal: "Upload document" modal (title optional, PDF/Office/images/TXT, max 10MB).
- Org owner/admin: "Assign to member" modal (member picker from `memberships`, same file validation).
- Context via `getWorkspaceContext()` — no `profiles.org_id` on documents path.

#### Audit
- `user_document_assigned` on org assignment (`writeAudit`, active org_id).

#### Touched
- `src/lib/user-documents/{constants,queries,storage}.ts`
- `src/app/app/documents/{page.tsx,user-doc-actions.ts}`
- `src/components/documents/{UserDocumentsLibrary,UploadUserDocumentModal,AssignUserDocumentModal,UserDocumentRowActions}.tsx`
- `src/lib/audit.ts`, `src/types/db.ts`, `README.md`

#### Note — storage policies
- User-doc uploads/deletes use the **service-role admin client** (same as generated pay PDFs), so existing `documents` bucket RLS path rules (`{org_id}/…`) do not block `user-docs/…` paths. If you later move uploads to the authenticated client, add storage policies for the `user-docs/` prefix.

### Session — Org document library + multi-assign + acknowledge + daily reminder (Build B) ✅ (2026-06-16, app-layer only)

#### Model (`official_documents` reused — onboarding compatibility preserved)
- **Library masters:** `employee_id` null, `org_id` = active org, `status` = `acknowledged` (catalog row), `signing_type` = `acknowledgement`, files in **`org-documents`** bucket at `{orgId}/library/{docId}/{filename}`. Masters never appear in onboarding (`employee_id` must be set for onboarding pending query).
- **Assigned copies:** one row per member on assign; same `file_path` as master; `employee_id` = member, `status` = `pending`, `signing_type` = `acknowledgement`. Acknowledge sets `status` = `acknowledged` + `signed_at` (no `signature_data`).
- **Onboarding unchanged:** legacy paths in `official-documents` bucket (`{orgId}/{employeeId}/…`); `e_signature` + `acknowledgement` flows in `official-documents/actions.ts`; onboarding page still loads `employee_id` = user + `status` = `pending`.
- **Personal library unchanged:** `user_documents` for personal uploads only; org-assign via `user_documents` UI removed in favour of org library.

#### Storage — **owner action required**
- New private bucket **`org-documents`** needed (not in migrations). Uploads fail until bucket + policies exist. Do **not** reuse `documents` or `official-documents` for library masters.

#### UI
- **Organization library** tab (owner/admin in org workspace): upload PDF/DOCX, list masters, multi-assign modal (select members or all).
- **Official documents** tab: personal `user_documents` + org-assigned `official_documents` rows (Org-assigned badge, pending/acknowledged status, view via full-screen viewer, acknowledge button, no delete).
- `OrgDocumentReminderCheck` in `AppShell` — opportunistic ack reminders (max one per doc per 24h via `org_document_ack_reminder` notification type).

#### Auth / audit / notifications
- Gated via `getWorkspaceContext()` + `auth_workspace_role()` (owner/admin); never `profiles.org_id` on this path.
- Audit: `org_document_uploaded`, `org_document_assigned`, `org_document_acknowledged`.
- Notify on assign (`official_document_assigned`); daily reminder while pending (`org_document_ack_reminder`).

#### Touched
- `src/lib/org-documents/{constants,queries,preview}.ts`
- `src/app/app/org-documents/actions.ts`
- `src/app/app/documents/page.tsx`
- `src/components/documents/{OrgDocumentLibrary,UploadOrgDocumentModal,AssignOrgDocumentModal,OrgAssignedDocumentRowActions,OrgDocumentReminderCheck,UserDocumentsLibrary,DocumentsTabs}.tsx`
- `src/components/app/{AppShell,NotificationsBell}.tsx`
- `src/lib/{audit,notifications}.ts`, `README.md`

### Session — Polish batch A (leave calendar, GCal removal, workspace loader, doc viewer) ✅ (2026-06-16, app-layer only; no DB change)

#### Fix L2 — Leave calendar rendering
- `LeaveEmployeeView.tsx`: marked/approved time-off renders as gold accent pills inside day cells (dashed pills for pending); supports multiple entries per day with "+N more" overflow; taller cells for legibility.

#### Fix L3 — Google Calendar event removal (`google_event_id` now wired)
- On personal mark / org approval: after GCal push, stores `google_event_id` on `leave_requests`.
- On personal delete, org cancel, or org reject: best-effort `deleteCalendarEvent` via `removeLeaveFromGoogleCalendar`; clears column; never blocks the leave mutation.
- `src/lib/google-calendar/{api,push-leave}.ts` — `deleteCalendarEvent` + `removeLeaveFromGoogleCalendar`.

#### Fix W1 — Workspace switch loading indicator
- `WorkspaceSwitchProvider` + full-app overlay ("Switching workspace…" / "Joining workspace…" / "Creating organization…") in `AppShell`.
- Driven from `WorkspaceSwitcher` on switch, invite accept, and create-org paths; dismisses on route change or error.

#### Fix D1 — Full-screen document viewer
- `UserDocumentViewer.tsx` — full-screen overlay for PDF (iframe), images, and **DOCX** (mammoth.js client-side HTML conversion).
- `userDocPreviewKind()` helper; DOCX conversion failures and non-previewable types (xlsx, etc.) fall back to download with toast.
- Wired into `UserDocumentRowActions` as View/Open action on Official documents tab.

### Session — F1 approval settings + F2 timer + F3 reporting + admin→Manager rename ✅ (2026-06-16)

#### F1 — org_settings + Organization page
- Migration `20260616000001_org_settings.sql` (table + RLS + `get_or_create_org_settings` RPC). **Applied externally on live Supabase** — file committed for repo parity.
- `OrgSettingsProvider` + `useOrgSettings()` — RPC fetch cached in React context (app shell).
- `/app/employees` restructured: **Members | Settings** tabs. Settings tab owner-only (approval toggles, approver scope radio, plan badge). Members matrix: owner full manage; manager list-only; employee redirect; superadmin read-only audit view with role badges.
- `updateOrgApprovalSettings` server action + optimistic save with toast; `org_settings_updated` audit.

#### F2 — Floating timer
- `TimerContext` + `FloatingTimer` in app shell (no localStorage).
- Start/stop, project picker, idle 30m modal, midnight split save, running-timer conflict prompt.
- `saveTimerEntries` server action; `time_entries.status` = `pending_approval` when `approvals_timesheets` on.
- Migration `20260630000001_time_entries_approval_status.sql`.

#### F3 — Reports
- `/app/reports` + nav entry (personal always; org tab owner/manager only).
- `src/lib/reports/queries.ts` — personal + org aggregates with explicit workspace filters.
- recharts project bar chart; org CSV export client-side.

#### UI rename
- `getRoleLabel` / `roleLabel` — `admin` → “Manager” in all user-facing strings; `RolePill` uses display helper. DB role value unchanged.

#### Untested (manual QA recommended)
- Live RPC + RLS on `org_settings` against production Supabase (migration assumed applied).
- Timer midnight auto-stop across real timezone boundaries.
- Org report utilization % with partial weeks.
- Approval `pending_approval` entries end-to-end with manager approval UI (enforcement UI deferred — settings only toggles status on timer save).

#### Remaining roadmap
- None from F-track — next priorities TBD (CFO agent consumer, webhook retry/backoff, API rate limiting).

#### Verification
- `npm run typecheck` passes.

### Bug fix — "No organization." toast on onboarding ✅ (2026-06-18)

- **Issue:** Personal-workspace users on `/app/onboarding` hit a stale `profile.org_id` guard in onboarding server actions, surfacing a "No organization." error toast.
- **Fix:** Gate `requireOrg()` in `src/app/app/onboarding/actions.ts` on the onboarding pathname (via request headers); suppress the same toast in `OnboardingWizard` when on `/app/onboarding`. The check still applies if those actions are invoked off-route.

#### Verification
- `npm run typecheck` passes.

### Session — F4 public API v1, webhooks-out, developer settings ✅ (2026-06-16)

#### F4 — Public API + webhooks-out
- **`api_keys` + `webhook_endpoints` tables** (applied externally on live Supabase — types in `src/types/db.ts` + `src/types/api.ts`).
- **`generateApiKey` / `revokeApiKey`** server actions; `validateApiKey` middleware (`src/lib/api-auth.ts`).
- **REST v1** under `src/app/api/v1/`: `time-entries` (GET/POST), `projects` (GET), `members` (GET, org key only).
- **`dispatchWebhookEvent`** (`src/lib/webhook-dispatcher.ts`) — HMAC-SHA256 signed POST, delivery log in `webhook_deliveries`.
- **Triggers wired** in timesheet submit/approve, leave request/approve/reject, invite send, invite accept/redeem.
- **Developer UI**: Profile API keys panel; Organization Settings tab API keys + webhook endpoints (owner/manager); managers can access Settings tab for Developer section; approval toggles remain owner-only.

#### Untested (manual QA recommended)
- Live RLS on `api_keys` / `webhook_endpoints` / extended `webhook_deliveries` against production.
- API v1 routes with real keys on deployed URL.
- Webhook signature verification on a test receiver.
- No delivery retry (single attempt by design for this session).

#### Remaining roadmap
- Webhook delivery retries / backoff.
- API rate limiting and scoped permissions per key.
- CFO Claude Agent consumer on `timesheet.approved`.

#### Verification
- `npm run typecheck` passes.

### Bug fix — DatePicker non-interactive on onboarding Employment step (production) ✅ (2026-06-19)

- **Issue:** `DatePicker` on `/app/onboarding` (Employment step, `start_date`) was completely unresponsive in production — trigger click, month navigation, and day selection did nothing. Worked locally (dev hydration masked the bug).
- **Root cause:** Same as the modal flicker fix — the calendar popover rendered as `position: absolute` inside `PageTransition`'s `<motion.div {...PAGE_TRANSITION}>` (animates `y` → `transform`). A transformed ancestor becomes the containing block for positioned descendants and can break pointer hit-testing in production builds.
- **Fix:** `DatePicker` now `createPortal`s its popover to `document.body` with `position: fixed` + trigger `getBoundingClientRect()` positioning (matches `RowActionsMenu` / `MotionModal` pattern). Month nav and day buttons call `e.preventDefault()` + `e.stopPropagation()` so clicks inside the onboarding `<form>` do not submit accidentally. Outside-click handler checks both trigger and portaled popover refs.

#### Verification
- `npm run build` passes.

### Session — Personal workspace role model audit & fix (Admin-equivalent personal context) ✅ (2026-06-20, app-layer only; no DB change)

#### Confirmed root cause
- `src/lib/workspace.ts` resolved **personal** context (`activeOrgId = null`, non-superadmin) to `effectiveProfile.role = "employee"`.
- This made standalone users appear and behave as org employees in personal context (incorrect role semantics for solo workspace).

#### Fix implemented
- `getWorkspaceContext()` now resolves non-superadmin personal context to:
  - `workspaceRole = "admin"` (admin-equivalent solo context)
  - `effectiveProfile.role = "admin"`
  - `effectiveProfile.org_id = null` (unchanged)
- Org-context role resolution is unchanged (still from `memberships` on active org).
- Superadmin detection/behavior is unchanged (`profiles.role = "superadmin"` path untouched).

#### Consumer hardening (to avoid org-leak semantics when personal role is admin-equivalent)
- Timesheets org-admin checks now require non-null org match (no null-org admin broadening):
  - `src/app/app/timesheets/actions.ts`
  - `src/app/app/timesheets/time-actions.ts`
  - `src/app/app/timesheets/[id]/page.tsx`
- Documents org-admin checks now require non-null org match:
  - `src/app/app/documents/actions.ts`
  - `src/lib/documents/authorization.ts`
  - `src/app/app/official-documents/actions.ts`
  - `src/app/api/timesheets/export/route.ts` (explicit 403 for admin with no org on export)
- Timesheets/Documents manager-mode routing is now workspace-aware (personal stays solo UX):
  - `src/app/app/timesheets/page.tsx`
  - `src/app/app/timesheets/log/page.tsx`
  - `src/app/app/documents/page.tsx`

#### Personal role labeling
- Profile now renders **Admin** badge in personal context (instead of Employee/Manager label drift):
  - `src/app/app/profile/page.tsx`

#### Notes on `profiles.role` default at signup
- App onboarding (`src/lib/onboarding.ts`) does not assign a non-superadmin role on signup; it only promotes superadmin by configured email and activates status.
- The persisted default role still comes from DB-side profile creation logic (historically employee). This session intentionally does **not** mutate stored `profiles.role`; it only fixes workspace-context role resolution.

### Session G follow-up — Fix 3 live-testing regressions (avatar, timesheets nav, period copy) ✅ (2026-06-20, app-layer + `avatar_url` migration)

**Branch:** `cursor/fix-three-regressions-246e` (pushed as PR; direct-to-main also acceptable for these regressions).

#### Bug 1 — Avatar presets reverted to initials
- **Root cause (multi-part):** The avatar feature was not fully wired end-to-end on `main`. `Topbar` never passed `src` to `Avatar` (always fell back to initials). Profile had no picker UI or `updateOwnAvatar` action. `profiles.avatar_url` column was missing from schema/types. No `resolveAvatarUrl()` — any future private-key paths would have been at risk of incorrect routing.
- **Fix:** Added `profiles.avatar_url` migration (`20260631000001_profiles_avatar_url.sql`) + types. `src/lib/avatar-url.ts` — presets (`/avatars/preset-N.svg`) pass through unchanged; private keys route to `/api/avatar`. `AvatarPickerSection` + `updateOwnAvatar` with error surfacing (no silent success). `revalidatePath("/app/profile")` + `revalidatePath("/app", "layout")` so Topbar refreshes. Replaced preset SVGs with 5 gold (`#C8973E`) head-and-shoulders silhouettes (3 male, 2 female) in `/public/avatars/`.

#### Bug 2 — Timesheets nav skipped list/history, opened log view directly
- **Root cause:** `src/app/app/timesheets/page.tsx` had an early `if (!isManager)` branch (introduced with the personal-workspace role fix, #17) that rendered `TimeTrackingView` inline instead of the list page. Personal and org-employee users hit this branch because `isManager` requires `activeOrgId` + owner/admin workspace role (or superadmin). The list page, filters, and “Log my time” CTA still existed in code but were unreachable.
- **Fix:** Removed the inline log branch. All roles now land on the unified list page (own timesheets for employees/personal; org-wide for managers). Status/date filters shown for everyone; employee filter remains manager-only. `TimesheetPageActions` “Log my time” → `/app/timesheets/log`. Log page back button restored for all users.

#### Bug 3 — Period-aware copy non-functional
- **Root cause:** Copy-to-period-days was never implemented on `main`. `TimeTrackingView` was week-only (`weekDays(weekMonday)`); no period toggle; no `copyEntryToDays`; no copy control on `TimeEntryRow`. Server loader (`getTimeTrackingData`) only ensured/fetched a Mon–Sun timesheet regardless of UI period intent.
- **Fix:** Added `ViewPeriodCadence` (`weekly` / `biweekly_15` / `monthly`) toggle + `periodDays()` rendering in `TimeTrackingView`. `getTimeTrackingData(anchor, viewCadence)` + `ensureTimesheetForViewPeriod` align timesheet boundaries and entry fetch to the selected period. `copyEntryToDays` enumerates `week.start`…`week.end` via `addDays` (the server-returned `week` now matches the active period view) and auto-persists copies. Copy icon on saved entries in `TimeEntryRow` (collapsed + expanded).

#### Verification
- `npm run build` passes.
- Manual QA recommended: preset avatar persist across reload (Profile + Topbar); timesheets nav → list → Log time → back; copy in week / 15-day / month views.

### Session — Topbar dropdown, avatar preset redesign, Leave calendar fixes ✅ (2026-06-20, app-layer only; no DB change)

**Pushed directly to `main`** (no PR — asset/UI-only, no migration).

#### Item 1 — Topbar avatar dropdown (never actually shipped in PR #24)
- **Root cause:** PR #24 only wired `resolveAvatarUrl(profile.avatar_url)` into the existing `Avatar` inside the old inline layout (name + email + separate `SignOutButton`). The dropdown redesign described in earlier sessions was never implemented on `main`.
- **Fix:** New `TopbarUserMenu` — avatar + chevron trigger, portaled dropdown (same click-outside/Escape pattern as `RowActionsMenu`). Menu items: **View profile** → `/app/profile`, **Logout** → existing `POST /auth/signout` form. Removed visible name/email/`SignOutButton` from `Topbar`.

#### Item 2 — Avatar preset asset redesign
- **Root cause:** N/A (design refresh, not a bug). Prior presets were uniform gold silhouettes on dark circles.
- **Fix:** Replaced `preset-1.svg`…`preset-5.svg` only — cartoon-style characters (3 male, 2 female) on distinct backgrounds (gold `#C8973E`, teal `#4A8F8F`, terracotta `#C97B5E`, sage `#7A9B76`, plum `#6B4E71`). Paths unchanged; `AVATAR_PRESETS` / persistence logic untouched.

#### Item 3a — Leave day-click → Mark Time Off dialog
- **Root cause:** `LeaveEmployeeView` day cells were plain `<div>` elements with no `onClick`. `RequestLeaveModal` had no `initialStartDate` prop. The feedback-batch fix (button cells + seed date) existed on a branch but never merged to `main` — handover claims were incorrect.
- **Fix:** Day cells are `<button>` with `onClick` → `setRequestSeedDate(iso)` + open modal. `RequestLeaveModal` accepts `initialStartDate` and pre-fills start/end dates.

#### Item 3b — Google Calendar events on Leave calendar
- **Root cause:** Leave page never fetched or passed GCal data. `leave/page.tsx` only loaded `leave_requests`; `LeaveEmployeeView` had no calendar-events prop. GCal sync writes to `google_calendar_events` (used by timesheets log via `getEventsForDay`) but the Leave route never read that table. Intentionally removed during the 2026-06-16 leave rebuild; never re-wired.
- **Fix:** `leave/page.tsx` SSR-fetches `getEventsForDateRange(profile.id, monthStart, monthEnd)` and passes `calendarEvents` to `LeaveEmployeeView`. Blue chips render synced events per day (overlap-aware); legend updated.

#### Verification
- `npm run build` passes.

### Session — Landing page rewrite + redesign (`/` marketing route) ✅ (2026-06-20, app-layer only; no DB change)

**Pushed directly to `main`** (public-facing content/design fix; no migration).

#### Why
- The old landing page (`src/components/marketing/LandingPage.tsx`) **described a different product than Cadence actually is.** It pitched spreadsheet upload / drag-and-drop CSV / Google Sheets parsing / "smart header mapping" and Xero/QuickBooks/Slack/Gmail integrations as core features — none of which exist in the current product (those were the legacy Phase 2 upload flow, since replaced by direct in-app time logging). It also carried **fabricated testimonials** (Alex Morgan / Priya Shah / James Okonkwo — not real people) and **broken static stat counters**.

#### What changed (structure)
- **Hero** now leads with the real differentiator — *personal-first, organization-optional*: "Your own timesheet today. Your team's when you're ready." Subhead frames it as one coherent idea (personal workspace from sign-up; org layered on later, same account, no re-onboarding).
- **Trust bar** reduced to the only real integrations: **Asana** + **Google Calendar** (removed Xero/QuickBooks/Slack/Gmail/generic "Google Sheets").
- **Features** rebuilt around real, currently-built capabilities: direct logging + floating timer, flexible periods (week / 15-day / monthly), full log→submit→lock lifecycle, per-entry copy-across-period, Asana + Google Calendar, provenance (timer-vs-manual) + secure per-user documents. Short one-idea blocks in a hairline-divided grid (no dense paragraph cards).
- **Stats band** replaced broken counters with **true** numbers (3 period lengths · 2 native integrations · 1 account solo→team) using the existing working `LandingCountUp` (GSAP, IntersectionObserver — fires correctly).
- **How it works** rewritten to the real flow: sign up → start logging in your personal workspace → (optional) create/join an org for approvals & team features.
- **Testimonials removed** — replaced with an honest **product showcase** (`ProductShowcase.tsx`): custom-styled floating-timer + timesheet-week mockup and a log/submit/locked lifecycle strip, built from app design tokens (no screenshots, no fake quotes).
- **Final CTA + footer** kept structurally; copy updated for accuracy ("Personal-first time tracking, payroll, and HR").

#### Custom graphics (all bespoke, gold/dark token palette)
- `HeroArt.tsx` — abstract SVG of one personal node expanding into a connected organization (the personal→org concept). Restrained Framer Motion: connectors draw in once on view, nodes settle with a soft stagger, personal node breathes, gentle pointer parallax; all disabled under `prefers-reduced-motion`.
- `FeatureIcons.tsx` — six hand-built SVG feature icons in one cohesive line system (1.4 stroke, square caps/miter joins, one purposeful accent node each), `currentColor`-driven.
- `ProductShowcase.tsx` — custom timer-widget + period mockup described above.

#### Technical
- **Dropped Three.js from the landing entirely** — deleted now-unused `HeroCanvas.tsx`; replaced the particle field with the lighter bespoke `HeroArt` SVG. `/` First Load JS ≈ 179 kB (Framer Motion already shared app-wide). Motion is scoped to `whileInView`/once + small idle pulses only.
- Light/dark via existing `globals.css` tokens only (no hardcoded colors); arbitrary `var(--radius-*)` radii resolve to sharp 0 in dark as designed. Mobile-responsive (stacking grids, `overflow-hidden` guards on the showcase so the floating widget never causes horizontal scroll).
- Routes intact: Sign in / Get started → `/login`; footer → `/privacy`, `/terms` (all verified 200).

#### Files
- Rewrote `src/components/marketing/LandingPage.tsx`.
- Added `src/components/marketing/{HeroArt,FeatureIcons,ProductShowcase}.tsx`.
- Deleted `src/components/marketing/HeroCanvas.tsx` (dead Three.js hero).

#### Verification
- `npm run typecheck`, `npm run lint`, `npm run build` all pass clean.
- Runtime smoke test (`/` → 200; new copy present; zero legacy claims Xero/QuickBooks/Google Sheets/"Three ways to submit"/fabricated names; `/login` `/privacy` `/terms` all 200).

---

### Session I — PR backlog cleanup + landing page copy fix ✅ (2026-06-20)

**Pushed directly to `main`** — no DB migrations involved in either part.
Commits: `aadd7fc` (PR backlog ports) + `989d7d2` (landing page copy).

---

#### Part 1 — PR backlog audit and cleanup

**PR #22 status (fact-check):** Owner believed this may already be merged — **it is NOT merged**. `session-f-fixes-and-visual-rebuild` shows as OPEN on GitHub and its content (personal period types, personal timesheet lifecycle: `submitPersonalTimesheet` / `lockPersonalTimesheet` / `requestPersonalTimesheetEdit` / `getPersonalTimeTrackingData`, design system v3 visual rebuild) is NOT on `main`. No action taken on #22 per session instructions (confirm status only). Owner should review and decide whether to merge, port selectively, or close.

**PR #16 (`cursor/feedback-batch-six-fixes-c4a4`) — DRAFT, closed.**
- What it contained: cadence periods view, TimesheetAccordionRow, TimesheetListFilters, draggable timer (Framer Motion), schema parity migration.
- Verdict: PARTIALLY superseded. Period-based view was shipped via PR #24; `TimesheetAccordionRow`/`TimesheetListFilters` were built on an old branch (pre-PR #17) and the UX was addressed differently in main; draggable timer was superseded by PR #20's better pointer-event implementation.
- Action: Parity migration (`supabase/migrations/20260619000001_feedback_batch_schema_prep.sql` — already applied to prod, committed here for repo integrity; adds `biweekly_15` enum value, makes `leave_requests.leave_type_id` nullable, adds `leave_requests.google_event_id`). Draggable timer ported from PR #20 (better implementation) instead. **Close this PR** from GitHub UI.

**PR #18 (`cursor/session-bc-small-fixes-investigation-2e22`) — OPEN, closed.**
- What it contained: minor rounded-corner style tweaks, GCal events on Leave calendar (already on main via Session H), Asana reconnect link open in new tab, `AsanaConnectBanner` updated with GCal icon/copy, dashboard showing banner when either Asana OR GCal not connected.
- Verdict: PARTIALLY superseded. Leave calendar GCal events already on main. Minor style tweaks marginal.
- Unique content ported: (a) `AsanaConnectBanner` updated to show both Asana + GCal icons and copy ("Connect Asana and Google Calendar"); (b) dashboard `showAsanaConnectBanner` logic now `true` when either integration is disconnected; (c) Asana reconnect link opens in new tab (`target="_blank"`). **Close this PR** from GitHub UI.

**PR #20 (`cursor/projects-asana-timer-time-tracked-ef7e`) — DRAFT, closed.**
- What it contained: draggable floating timer (pointer-event-based), Time tracked page, Asana projects section on Projects page, nav additions.
- Verdict: NOT superseded — all three features are unique and not on main.
- Unique content ported: (a) **Draggable floating timer** — pointer-event-based with localStorage position persist per user, viewport-clamped; `FloatingTimer` now accepts `userId` prop threaded through `AppProviders` → `AppShell`; (b) **Time tracked page** (`/app/time-tracked`) — history of timer entries with week/month/custom date filter and project filter; (c) **"Time tracked" nav item** added to all workspace contexts (personal/employee/manager/superadmin); (d) `timeTracked` icon added to `NavIcon.tsx`. **Close this PR** from GitHub UI.

**PR #23 (`session-g-avatar-header-logtime-asana`) — OPEN, closed.**
- What it contained: avatar system, Topbar dropdown, log time back button, Asana projects section on Projects page, avatar storage bucket migration.
- Verdict: PARTIALLY superseded. Avatar system (PR #24), Topbar dropdown (Session H), back button (PR #24) all already on main.
- Unique content ported: (a) **Asana projects section on Projects page** — `getMyImportedAsanaProjects()` server action; `ProjectsManager` shows a separate "Asana projects" section for imported projects; `projects/page.tsx` fetches and passes `asanaProjects`; asana-actions revalidate `/app/projects` on import/remove/sync/disconnect; (b) Avatar storage bucket migration (`20260620100000_profile_avatar_url.sql`) was intentionally NOT ported — main already has `20260631000001_profiles_avatar_url.sql` which adds the column (the feature uses preset SVGs only; custom upload path doesn't require the bucket yet). **Close this PR** from GitHub UI.

**Note on closing PRs:** GitHub write access not available via `gh` CLI or MCP in this environment. Owner must close PRs #16, #18, #20, #23 manually from the GitHub UI (iamsharjeeel/cadence).

---

#### Part 2 — Landing page copy fix

Removed "personal-first, organization-optional" framing across the landing page. Changes:
- **Hero eyebrow badge**: Removed `"Personal-first · organization-optional"` label entirely.
- **Hero headline**: `"Your own timesheet today. / Your team's when you're ready."` → `"Complete time tracking, / solo or with your team."` — both modes co-equal in the headline.
- **Hero subhead**: Rewritten to present solo AND org as full, co-equal capabilities ("Every Cadence account ships complete from day one…Use it entirely on your own, or bring in a team for a full org platform with Manager/Admin roles, approval workflows, and shared projects. One account, either way.").
- **Features section subhead**: `"Built for individuals first, with the depth a small team needs when it grows into one."` → `"Every feature works fully on day one as a solo user. Every feature scales into a complete org platform when your team joins."` — parallel structure, equal weight.
- **Features: Periods copy**: `"No organization policy required to get started."` → `"Works the same whether you're solo or inside an organization."` — positive, not a hedge.
- **How it works step 3**: `"Add your team — optional"` → `"Grow with your team"` — natural next capability, not a parenthetical.
- **How it works section subhead**: `"No forced organization setup. Start the day you sign up; bring a team along only if and when you need to."` → `"Start the day you sign up, no org required. Bring a team in for the full platform — approvals, roles, shared projects — whenever the time is right."` — positions org as a full upgrade, not a hedge.
- **Final CTA subhead**: `"Add a team whenever you're ready — the account grows with you."` → `"Use it solo, or scale up to a full team with roles, approvals, and org-wide projects — the account works completely either way."` — both modes explicitly featured.
- **Footer tagline**: `"Personal-first time tracking, payroll, and HR."` → `"Time tracking, payroll, and HR for individuals and teams."` — removes "personal-first" label.

Structure, custom graphics, stats, features all unchanged — this was a copy/tone pass only.

`npm run build` passes clean.

---

### Session J — PR #22 audit (`session-f-fixes-and-visual-rebuild`) ✅ (2026-06-20)

**Pushed directly to `main`** — no DB migrations involved.

**Branch diffed:** `origin/session-f-fixes-and-visual-rebuild` vs `main` (5 commits, 40 files, ~1.3k insertions / ~800 deletions on the branch).

**Fact-check on prior-session note:** Session I recorded PR #22 as still OPEN; owner has since closed it. Branch still exists on GitHub (closing a PR does not delete the branch).

---

#### What PR #22 contained (verified from branch diff)

1. **Personal timesheet lifecycle** — `submitPersonalTimesheet`, `lockPersonalTimesheet`, `requestPersonalTimesheetEdit`, 3-day edit window, auto-lock after window, "Mark as complete" gating (available 3 days before period end), locked-state banner + edit-request modal (audit-only, does not unlock).
2. **Personal period types** — `PersonalPeriodType` (`week` / `15day` / `30day`) with localStorage preference, `personalPeriodForDate` / `shiftPersonalPeriod` / `allDaysInPeriod`, separate `isPersonal` code path in `TimeTrackingView`.
3. **Copy / duplicate helpers** — `copyEntriesFromPreviousPeriod` (server, date-shifted bulk copy), `duplicateTimeEntry` (server, single entry to target date) + `TimeEntryRow` duplicate dropdown UI.
4. **Design system v3** — `globals.css` token overhaul: sharper radii (6px/4px light, 0 dark), `#C8973E` gold accent, Stripe-style shadows, neutral gray surfaces; `Table.tsx` / `buttonStyles.ts` tweaks; hardcoded `rounded-[12px]` → `var(--radius-card)` in profile panels.
5. **Settings/profile split** — new `/app/user-settings` page (connected accounts + API keys); removed connected accounts + developer section from `/app/profile`; OAuth callbacks redirect to `user-settings`.
6. **Nav changes** — removed Reports nav item; added Settings → `/app/user-settings`.
7. **Reports deletion** — removed `/app/reports` page, `ReportsClient.tsx`, `reports-actions.ts`.
8. **Timesheets page restructuring** — all users see list view; non-managers no longer get inline `TimeTrackingView` on `/app/timesheets`.
9. **Leave calendar** — GCal event pills on calendar, click-day-to-prefill modal date, `getGCalEventsForMonth` query.
10. **AsanaConnectBanner** — dual Asana+GCal icons/copy, show when either disconnected (dashboard passes both flags).
11. **Misc** — `timesheet_edit_requested` audit action; `submittedAt` on `TimeTrackingData`; `ensureTimesheetForPeriod` refactor in `get-time-tracking-data.ts`.

---

#### Verdict and actions taken

**PR #16/#18/#20/#23 overlap:** Items 9 (leave GCal) and 10 (AsanaConnectBanner) were already ported in Session I. Item 2 (period types) was superseded on `main` by Session G's `ViewPeriodCadence` (`weekly` / `biweekly_15` / `monthly`) + `periodDays()` — strictly better integrated than PR #22's parallel `PersonalPeriodType` path.

**PORTED (adapted to current `main` architecture):**

| Item | Reasoning |
|------|-----------|
| Personal timesheet lifecycle (#1) | **Genuinely missing.** `main` explicitly refused personal submit (`"Personal timesheets are not submitted for approval"`). PR #24 / Session G shipped period-view toggle only — not submit/lock/edit-request. Ported using `!hasOrgContext` gating (not PR #22's `isPersonal` prop), wired to existing `ViewPeriodCadence` / `periodAnchor` / `week` state. |
| `copyEntriesFromPreviousPeriod` (#3, partial) | Useful personal-workspace QoL; no equivalent on `main`. Adapted to `viewPeriodForDate` + `shiftViewPeriod` + `ensureTimesheetForViewPeriod`. UI button in period summary sidebar (draft only). |
| `submittedAt` on `TimeTrackingData` | Required for edit-window tracking; `ensureTimesheetForViewPeriod` now returns approved personal timesheets + `submittedAt` from `updated_at`. |
| `timesheet_edit_requested` audit action | Required for `requestPersonalTimesheetEdit`. |

**NOT PORTED:**

| Item | Reasoning |
|------|-----------|
| Design system v3 (#4) | **Superseded.** Current `main` runs design tokens v2 with Session H polish (density pass, dark-mode fixes, landing page graphics). PR #22's v3 would regress intentional accent/radius choices and conflict with post-Session-H visual state. |
| `PersonalPeriodType` / parallel period path (#2) | **Superseded** by `ViewPeriodCadence` on `main`. |
| `duplicateTimeEntry` + row dropdown (#3, partial) | **Superseded.** `main` already has `copyEntryToDays` (client-side, copy saved entry to all other days in period). PR #22's per-date server duplicate is marginal given existing copy UX. |
| `/app/user-settings` + profile split (#5) | **Conflicts with current IA.** `main` keeps connected accounts on `/app/profile` and org admin on `/app/settings`. Splitting would duplicate nav and break OAuth callback targets already wired to profile. **Needs owner decision** if a dedicated user-settings page is still wanted. |
| Reports deletion + nav removal (#6–7) | **Regression.** Reports page is live and in nav on `main`. |
| Timesheets page inline-log removal (#8) | **Already addressed differently.** `main` shows list + "Log time" button for non-managers; inline log lives at `/app/timesheets/log`. PR #22's version is equivalent, not an improvement. |
| Leave calendar GCal + click-prefill (#9) | **Already on `main`** (Session H): `getEventsForDateRange`, `calendarEvents` prop, `requestSeedDate`, `GCalDayChip`. |
| AsanaConnectBanner dual-icon (#10) | **Already on `main`** (Session I, from PR #18). |
| Table/button style tweaks (#4 partial) | Bundled with design system v3; not ported standalone. |
| `getPersonalTimeTrackingData` | **Superseded** by `getTimeTrackingData(anchor, viewCadence)` on `main`. |

**Needs owner decision:**

- **`/app/user-settings` page** — PR #22 split integrations/API keys out of Profile into a dedicated Settings page. Not ported; current IA works but owner may prefer the split.
- **`duplicateTimeEntry` per-date duplicate** — if per-date server duplicate is wanted over the existing "copy to all other days" client flow.

**DB migrations:** None required. All changes are app-layer; uses existing `timesheets.status` values (`draft` → `submitted` → `approved`) and `audit_log` table.

#### Verification

- `npm run build` passes clean (only pre-existing `<img>` lint warnings).
- Personal timesheet flow traced in code: draft → "Mark as complete" (gated ≤3 days before period end) → `submitted` + 3-day edit window → auto `lockPersonalTimesheet` → `approved`/locked → "Request edit access" writes `timesheet_edit_requested` audit (no unlock). Org submit/lock path unchanged (`hasOrgContext` gate).
- No visual tokens ported — light/dark unchanged from Session H baseline.

**Close PR #22** from GitHub UI if not already closed. Branch `session-f-fixes-and-visual-rebuild` can be deleted after owner confirms.

---

### Session K — Approve/Reject fix, profile/settings split, copy-to-days popup ✅ (2026-06-20)

**Pushed directly to `main`** — no DB migrations.

#### 1 — Remove Approve/Reject from personal timesheet detail

- **Problem:** `ApprovalControls` on `/app/timesheets/[id]` rendered for any viewer with `admin`/`superadmin` role, including personal timesheets (`org_id IS NULL`).
- **Fix:** Gate `canApprove` on `timesheet.org_id != null` (`hasOrgContext` pattern). `ApprovalControls` panel removed entirely for personal timesheets — not disabled, not shown. `TimesheetStatusPill` `live` draft indicator and `isReadOnlyAdmin` also gated on org context. Recall/Delete/Back header actions unchanged (`TimesheetStatusActions` + `DeleteTimesheetControl` still owner/org-scoped as before).

#### 2 — Split Profile and User Settings

- **New page:** `/app/user-settings` — Connected accounts (Asana + Google Calendar) + personal API keys panel, relocated from Profile without redesign.
- **Profile** (`/app/profile`) — identity/personal info only: avatar, name, employment, banking, emergency contact, completeness.
- **Nav:** New top-level **Settings** item → `/app/user-settings` (sliders icon) in all workspace contexts. Org admin `/app/settings` relabeled **Org settings** in manager/superadmin nav to avoid collision.
- **OAuth redirects:** Asana + Google Calendar connect/callback/error URLs now land on `/app/user-settings` (with `#section-connected` hash for GCal).
- **Internal links updated:** `AsanaConnectBanner`, `AsanaProjectPicker`, `ProjectsManager`, `NotificationsBell`, `ConnectedAccountsSection` flash cleanup.
- **Revalidation paths:** `api-keys/actions`, `asana-actions`, `google-calendar-actions` now revalidate `/app/user-settings`.
- Removed unused `ProfileDeveloperSection.tsx` (logic inlined on user-settings page via `ApiKeysPanel`).

#### 3 — Copy-to-days selection popup

- **Replaced:** Instant "copy to all other days in period" behavior.
- **New UX:** Copy icon opens a branded modal (same pattern as "Request edit access" — overlay, `rounded-[var(--radius-card)]`, surface tokens, `Button` components). Scrollable checklist of all days in the current period except the source day; nothing pre-checked; **Copy to selected** runs existing `copyEntryToDays` persist logic for checked days only.

#### Verification

- `npm run build` passes clean.
- Personal timesheet detail: no Approve/Reject panel at any status.
- Org timesheet detail: Approve/Reject unchanged for managers.
- `/app/profile` and `/app/user-settings` both build; nav shows Profile + Settings as separate items.
- OAuth callback routes redirect to `/app/user-settings`.

**DB migrations:** None.
---

### Session J — PR #22 audit (`session-f-fixes-and-visual-rebuild`) ✅ (2026-06-20)

**Pushed directly to `main`** — no DB migrations involved.

**Branch diffed:** `origin/session-f-fixes-and-visual-rebuild` vs `main` (5 commits, 40 files, ~1.3k insertions / ~800 deletions on the branch).

**Fact-check on prior-session note:** Session I recorded PR #22 as still OPEN; owner has since closed it. Branch still exists on GitHub (closing a PR does not delete the branch).

---

#### What PR #22 contained (verified from branch diff)

1. **Personal timesheet lifecycle** — `submitPersonalTimesheet`, `lockPersonalTimesheet`, `requestPersonalTimesheetEdit`, 3-day edit window, auto-lock after window, "Mark as complete" gating (available 3 days before period end), locked-state banner + edit-request modal (audit-only, does not unlock).
2. **Personal period types** — `PersonalPeriodType` (`week` / `15day` / `30day`) with localStorage preference, `personalPeriodForDate` / `shiftPersonalPeriod` / `allDaysInPeriod`, separate `isPersonal` code path in `TimeTrackingView`.
3. **Copy / duplicate helpers** — `copyEntriesFromPreviousPeriod` (server, date-shifted bulk copy), `duplicateTimeEntry` (server, single entry to target date) + `TimeEntryRow` duplicate dropdown UI.
4. **Design system v3** — `globals.css` token overhaul: sharper radii (6px/4px light, 0 dark), `#C8973E` gold accent, Stripe-style shadows, neutral gray surfaces; `Table.tsx` / `buttonStyles.ts` tweaks; hardcoded `rounded-[12px]` → `var(--radius-card)` in profile panels.
5. **Settings/profile split** — new `/app/user-settings` page (connected accounts + API keys); removed connected accounts + developer section from `/app/profile`; OAuth callbacks redirect to `user-settings`.
6. **Nav changes** — removed Reports nav item; added Settings → `/app/user-settings`.
7. **Reports deletion** — removed `/app/reports` page, `ReportsClient.tsx`, `reports-actions.ts`.
8. **Timesheets page restructuring** — all users see list view; non-managers no longer get inline `TimeTrackingView` on `/app/timesheets`.
9. **Leave calendar** — GCal event pills on calendar, click-day-to-prefill modal date, `getGCalEventsForMonth` query.
10. **AsanaConnectBanner** — dual Asana+GCal icons/copy, show when either disconnected (dashboard passes both flags).
11. **Misc** — `timesheet_edit_requested` audit action; `submittedAt` on `TimeTrackingData`; `ensureTimesheetForPeriod` refactor in `get-time-tracking-data.ts`.

---

#### Verdict and actions taken

**PR #16/#18/#20/#23 overlap:** Items 9 (leave GCal) and 10 (AsanaConnectBanner) were already ported in Session I. Item 2 (period types) was superseded on `main` by Session G's `ViewPeriodCadence` (`weekly` / `biweekly_15` / `monthly`) + `periodDays()` — strictly better integrated than PR #22's parallel `PersonalPeriodType` path.

**PORTED (adapted to current `main` architecture):**

| Item | Reasoning |
|------|-----------|
| Personal timesheet lifecycle (#1) | **Genuinely missing.** `main` explicitly refused personal submit (`"Personal timesheets are not submitted for approval"`). PR #24 / Session G shipped period-view toggle only — not submit/lock/edit-request. Ported using `!hasOrgContext` gating (not PR #22's `isPersonal` prop), wired to existing `ViewPeriodCadence` / `periodAnchor` / `week` state. |
| `copyEntriesFromPreviousPeriod` (#3, partial) | Useful personal-workspace QoL; no equivalent on `main`. Adapted to `viewPeriodForDate` + `shiftViewPeriod` + `ensureTimesheetForViewPeriod`. UI button in period summary sidebar (draft only). |
| `submittedAt` on `TimeTrackingData` | Required for edit-window tracking; `ensureTimesheetForViewPeriod` now returns approved personal timesheets + `submittedAt` from `updated_at`. |
| `timesheet_edit_requested` audit action | Required for `requestPersonalTimesheetEdit`. |

**NOT PORTED:**

| Item | Reasoning |
|------|-----------|
| Design system v3 (#4) | **Superseded.** Current `main` runs design tokens v2 with Session H polish (density pass, dark-mode fixes, landing page graphics). PR #22's v3 would regress intentional accent/radius choices and conflict with post-Session-H visual state. |
| `PersonalPeriodType` / parallel period path (#2) | **Superseded** by `ViewPeriodCadence` on `main`. |
| `duplicateTimeEntry` + row dropdown (#3, partial) | **Superseded.** `main` already has `copyEntryToDays` (client-side, copy saved entry to all other days in period). PR #22's per-date server duplicate is marginal given existing copy UX. |
| `/app/user-settings` + profile split (#5) | **Conflicts with current IA.** `main` keeps connected accounts on `/app/profile` and org admin on `/app/settings`. Splitting would duplicate nav and break OAuth callback targets already wired to profile. **Needs owner decision** if a dedicated user-settings page is still wanted. |
| Reports deletion + nav removal (#6–7) | **Regression.** Reports page is live and in nav on `main`. |
| Timesheets page inline-log removal (#8) | **Already addressed differently.** `main` shows list + "Log time" button for non-managers; inline log lives at `/app/timesheets/log`. PR #22's version is equivalent, not an improvement. |
| Leave calendar GCal + click-prefill (#9) | **Already on `main`** (Session H): `getEventsForDateRange`, `calendarEvents` prop, `requestSeedDate`, `GCalDayChip`. |
| AsanaConnectBanner dual-icon (#10) | **Already on `main`** (Session I, from PR #18). |
| Table/button style tweaks (#4 partial) | Bundled with design system v3; not ported standalone. |
| `getPersonalTimeTrackingData` | **Superseded** by `getTimeTrackingData(anchor, viewCadence)` on `main`. |

**Needs owner decision:**

- **`/app/user-settings` page** — PR #22 split integrations/API keys out of Profile into a dedicated Settings page. Not ported; current IA works but owner may prefer the split.
- **`duplicateTimeEntry` per-date duplicate** — if per-date server duplicate is wanted over the existing "copy to all other days" client flow.

**DB migrations:** None required. All changes are app-layer; uses existing `timesheets.status` values (`draft` → `submitted` → `approved`) and `audit_log` table.

#### Verification

- `npm run build` passes clean (only pre-existing `<img>` lint warnings).
- Personal timesheet flow traced in code: draft → "Mark as complete" (gated ≤3 days before period end) → `submitted` + 3-day edit window → auto `lockPersonalTimesheet` → `approved`/locked → "Request edit access" writes `timesheet_edit_requested` audit (no unlock). Org submit/lock path unchanged (`hasOrgContext` gate).
- No visual tokens ported — light/dark unchanged from Session H baseline.

**Close PR #22** from GitHub UI if not already closed. Branch `session-f-fixes-and-visual-rebuild` can be deleted after owner confirms.

---

### Session K — Approve/Reject fix, profile/settings split, copy-to-days popup ✅ (2026-06-20)

**Pushed directly to `main`** — no DB migrations.

#### 1 — Remove Approve/Reject from personal timesheet detail

- **Problem:** `ApprovalControls` on `/app/timesheets/[id]` rendered for any viewer with `admin`/`superadmin` role, including personal timesheets (`org_id IS NULL`).
- **Fix:** Gate `canApprove` on `timesheet.org_id != null` (`hasOrgContext` pattern). `ApprovalControls` panel removed entirely for personal timesheets — not disabled, not shown. `TimesheetStatusPill` `live` draft indicator and `isReadOnlyAdmin` also gated on org context. Recall/Delete/Back header actions unchanged (`TimesheetStatusActions` + `DeleteTimesheetControl` still owner/org-scoped as before).

#### 2 — Split Profile and User Settings

- **New page:** `/app/user-settings` — Connected accounts (Asana + Google Calendar) + personal API keys panel, relocated from Profile without redesign.
- **Profile** (`/app/profile`) — identity/personal info only: avatar, name, employment, banking, emergency contact, completeness.
- **Nav:** New top-level **Settings** item → `/app/user-settings` (sliders icon) in all workspace contexts. Org admin `/app/settings` relabeled **Org settings** in manager/superadmin nav to avoid collision.
- **OAuth redirects:** Asana + Google Calendar connect/callback/error URLs now land on `/app/user-settings` (with `#section-connected` hash for GCal).
- **Internal links updated:** `AsanaConnectBanner`, `AsanaProjectPicker`, `ProjectsManager`, `NotificationsBell`, `ConnectedAccountsSection` flash cleanup.
- **Revalidation paths:** `api-keys/actions`, `asana-actions`, `google-calendar-actions` now revalidate `/app/user-settings`.
- Removed unused `ProfileDeveloperSection.tsx` (logic inlined on user-settings page via `ApiKeysPanel`).

#### 3 — Copy-to-days selection popup

- **Replaced:** Instant "copy to all other days in period" behavior.
- **New UX:** Copy icon opens a branded modal (same pattern as "Request edit access" — overlay, `rounded-[var(--radius-card)]`, surface tokens, `Button` components). Scrollable checklist of all days in the current period except the source day; nothing pre-checked; **Copy to selected** runs existing `copyEntryToDays` persist logic for checked days only.

#### Verification

- `npm run build` passes clean.
- Personal timesheet detail: no Approve/Reject panel at any status.
- Org timesheet detail: Approve/Reject unchanged for managers.
- `/app/profile` and `/app/user-settings` both build; nav shows Profile + Settings as separate items.
- OAuth callback routes redirect to `/app/user-settings`.

**DB migrations:** None.

---

### Session K — Approve/Reject fix, profile/settings split, copy-to-days popup ✅ (2026-06-20)

**Pushed directly to `main`** — no DB migrations.

#### 1 — Remove Approve/Reject from personal timesheet detail

- **Problem:** `ApprovalControls` on `/app/timesheets/[id]` rendered for any viewer with `admin`/`superadmin` role, including personal timesheets (`org_id IS NULL`).
- **Fix:** Gate `canApprove` on `timesheet.org_id != null` (`hasOrgContext` pattern). `ApprovalControls` panel removed entirely for personal timesheets — not disabled, not shown. `TimesheetStatusPill` `live` draft indicator and `isReadOnlyAdmin` also gated on org context. Recall/Delete/Back header actions unchanged (`TimesheetStatusActions` + `DeleteTimesheetControl` still owner/org-scoped as before).

#### 2 — Split Profile and User Settings

- **New page:** `/app/user-settings` — Connected accounts (Asana + Google Calendar) + personal API keys panel, relocated from Profile without redesign.
- **Profile** (`/app/profile`) — identity/personal info only: avatar, name, employment, banking, emergency contact, completeness.
- **Nav:** New top-level **Settings** item → `/app/user-settings` (sliders icon) in all workspace contexts. Org admin `/app/settings` relabeled **Org settings** in manager/superadmin nav to avoid collision.
- **OAuth redirects:** Asana + Google Calendar connect/callback/error URLs now land on `/app/user-settings` (with `#section-connected` hash for GCal).
- **Internal links updated:** `AsanaConnectBanner`, `AsanaProjectPicker`, `ProjectsManager`, `NotificationsBell`, `ConnectedAccountsSection` flash cleanup.
- **Revalidation paths:** `api-keys/actions`, `asana-actions`, `google-calendar-actions` now revalidate `/app/user-settings`.
- Removed unused `ProfileDeveloperSection.tsx` (logic inlined on user-settings page via `ApiKeysPanel`).

#### 3 — Copy-to-days selection popup

- **Replaced:** Instant "copy to all other days in period" behavior.
- **New UX:** Copy icon opens a branded modal (same pattern as "Request edit access" — overlay, `rounded-[var(--radius-card)]`, surface tokens, `Button` components). Scrollable checklist of all days in the current period except the source day; nothing pre-checked; **Copy to selected** runs existing `copyEntryToDays` persist logic for checked days only.

#### Verification

- `npm run build` passes clean.
- Personal timesheet detail: no Approve/Reject panel at any status.
- Org timesheet detail: Approve/Reject unchanged for managers.
- `/app/profile` and `/app/user-settings` both build; nav shows Profile + Settings as separate items.
- OAuth callback routes redirect to `/app/user-settings`.

**DB migrations:** None.

---

### Session — P0 fixes: memberships notifications, doc assignment, resubmit param, invite-only copy ✅ (2026-07-02)

**Pushed directly to `main`** — no DB migrations.

#### 1 — Org admin notifications broken

- **Root cause:** Post–Track C, `notifyOrgAdmins()` queried `profiles` with `.eq("org_id", …).eq("role", "admin")`. `profiles.org_id` is vestigial (null for invite-joined members), so the query returned nobody; `owner` role was also excluded.
- **Fix:** Query `memberships` for `org_id` + `role IN ('owner','admin')`, then filter to active users via `profiles` (`id IN (…)`, `status = 'active'`). Preserved `excludeUserId` and per-user `notifyUser` loop. JSDoc updated to say owners and managers.

#### 2 — Org document assignment validates against stale profiles.org_id

- **Root cause:** `uploadOfficialDocument` assign flow enumerated employees and validated a single assignee via `profiles.org_id`, missing every invite-joined member.
- **Fix:** Resolve target users from `memberships` (`org_id = orgId`). Assign-all path: `role = 'employee'` + active `profiles`. Single assign: any org membership role + active profile. Matches pattern in `listOrgMembersForOfficialAssign`.

#### 3 — "Edit & resubmit" opens wrong week

- **Root cause:** `TimesheetStatusActions` pushed `/app/timesheets/log?week=…` but the log page reads `searchParams.date`.
- **Fix:** Changed query param from `week` to `date`.

#### 4 — Stale domain auto-join copy

- **Root cause:** Domain auto-attach was removed (invite-only joining) but UI copy still claimed matching domains auto-join teams.
- **Fix (copy only):** Updated login page, `CreateOrgForm` allowed-domains hint, and `GeneralSettingsTab` allowed-domains description to state invite-only joining and reference-only domains.

#### Files touched

- `src/lib/notifications.ts`
- `src/app/app/official-documents/actions.ts`
- `src/app/app/timesheets/TimesheetStatusActions.tsx`
- `src/app/login/page.tsx`
- `src/app/app/organizations/CreateOrgForm.tsx`
- `src/app/app/settings/GeneralSettingsTab.tsx`
- `README.md`
- `HANDOVER.md`

#### Verification

- `npm run typecheck` — pass
- `npm run lint` — pass (pre-existing `<img>` warnings only)
- `npm run build` — pass

**DB migrations:** None.

---

### Session — Phase 2 P1 functional fixes ✅ (2026-07-02)

**Pushed directly to `main`** — no DB migrations.

#### 1 — Org leave approval toggle never read

- **Root cause:** `org_settings.approvals_leave` was saved in Organization → Settings but `requestLeave()` always inserted `status: "pending"`.
- **Fix:** Fetch settings via `get_or_create_org_settings` (`fetchOrgSettings`). When `approvals_leave` is false, insert as `approved`, run Google Calendar push + `google_event_id` storage, audit (`leave_approved`), and `leave.approved` webhook; return "Time off added." Pending path unchanged when toggle is on.

#### 2 — Time tracked page wrong durations and scope

- **Root cause:** Page rendered raw DB `total_hours` (negative overnight) and filtered to `entry_mode === "time_range"` only. Timer entries are not distinguishable in DB (same `time_range` mode as manual entries).
- **Fix:** Added `entryHours()` using `durationHours()`; removed entry_mode filter (includes decimal-hours); updated page copy to "all logged time entries"; status pill shows "Logged" when status is null, "Pending"/"Approved" only when applicable.

#### 3 — Decimal-hours entries don't auto-save on blur

- **Root cause:** `onBlurField` in `TimeTrackingView` only scheduled saves for `start_time`, `end_time`, and `description`.
- **Fix:** Added `decimal_hours` to the blur-save allowlist (field name confirmed in `TimeEntryRow`).

#### 4 — Personal "Request edit access" is a dead end

- **Root cause:** Action wrote an audit row and returned "Edit request logged." with no unlock workflow.
- **Fix:** Updated modal copy and action message to explain audit-trail record-keeping only; timesheet stays locked. No unlock flow built.

#### 5 — Onboarding completion failure invisible

- **Root cause:** `runFinish()` and skip/final-step paths ignored `completeOnboarding()` failures and still redirected.
- **Fix:** Surface errors via existing `showActionToast()`; only set `done`/redirect on success.

#### 6 — Sidebar/topbar never highlight on nested routes

- **Root cause:** `NavLink` and `Topbar` used exact pathname equality.
- **Fix:** Added `matchNavHref` / `findActiveNavItem` (longest-prefix match). `NavLink` receives `allNavHrefs`; `aria-current="page"` on active link. Mobile topbar shows matched section label instead of wordmark when a match exists.

#### 7 — Time-log reminder notification unclickable

- **Root cause:** `time_log_reminder` inserted without `entity_id`; `entityHref` returned null without both entity and entity_id.
- **Fix:** Type-based mapping: `n.type === "time_log_reminder"` → `/app/timesheets/log`.

#### Files touched

- `src/app/app/leave/actions.ts`
- `src/app/app/time-tracked/page.tsx`
- `src/app/app/timesheets/TimeTrackingView.tsx`
- `src/app/app/timesheets/time-actions.ts`
- `src/app/app/onboarding/OnboardingWizard.tsx`
- `src/components/app/nav.ts`
- `src/components/app/NavLink.tsx`
- `src/components/app/Sidebar.tsx`
- `src/components/app/Topbar.tsx`
- `src/components/app/NotificationsBell.tsx`
- `README.md`
- `HANDOVER.md`

#### Verification

- `npm run typecheck` — pass
- `npm run lint` — pass (pre-existing `<img>` warnings only)
- `npm run build` — pass

**DB migrations:** None.

### Session — Phase 3 coverage: loading/error boundaries, empty-state CTAs, leave month nav, mobile team table, legal pages ✅ (2026-07-02)

**Pushed directly to `main`** — no DB migrations.

#### 1 — Error boundaries (`error.tsx`)

Added route-level error boundaries reusing `RouteError` pattern for:
- `src/app/app/reports/error.tsx`
- `src/app/app/time-tracked/error.tsx`
- `src/app/app/projects/error.tsx`
- `src/app/app/user-settings/error.tsx`
- `src/app/app/onboarding/error.tsx`
- `src/app/app/organizations/error.tsx`
- `src/app/app/orgs/[slug]/dashboard/error.tsx`
- `src/app/app/timesheets/[id]/error.tsx`

#### 2 — Route loading skeletons (`loading.tsx`)

Layout-matched skeletons using `CardSkeleton`, `TableRowsSkeleton`, and local compositions:
- `dashboard`, `timesheets`, `timesheets/log`, `leave`, `documents`, `employees`, `reports`, `projects`, `trends`, `time-tracked`, `audit`, `user-settings`, `profile`, `settings`

#### 3 — Empty states with CTAs

- **Employee dashboard** — recent timesheets empty → `EmptyState` + "Log time" → `/app/timesheets/log`
- **Superadmin org grid** — no orgs → `EmptyState` → `/app/organizations`
- **Timesheets list** — `EmptyState` action → `/app/timesheets/log`
- **Reports** — personal chart empty links to log; project/member tables show friendly empty rows
- **Time tracked** — description mentions floating timer + "Log time manually" link
- **Leave history** — `EmptyState` with button opening request/mark-time-off modal
- **Leave admin queue** — "You're all caught up" `EmptyState`
- **Documents** — failed signed URL rows show muted "Unavailable" with tooltip

#### 4 — Leave calendar month navigation

- `leave/page.tsx` reads optional `?month=YYYY-MM`, computes month bounds, fetches GCal events for that range
- `LeaveEmployeeView` renders prev/next/Today controls (styled like timesheet period nav); day-click mark-time-off unchanged
- Admin view untouched

#### 5 — Team table mobile

- `OrgTeamView`: `Onboarding`, `Banking`, `Rate` columns use `hidden md:table-cell` on TH and TD

#### 6 — Profile role badge

- Personal workspace (non-superadmin): neutral "Personal account" badge instead of "Admin"

#### 7 — Privacy & Terms

- Replaced placeholder marketing pages with product-specific Privacy Policy and Terms of Service (last updated July 2026)

#### Files touched

- New: 8× `error.tsx`, 14× `loading.tsx`
- Modified: `EmployeeDashboardContent.tsx`, `dashboard/page.tsx`, `timesheets/page.tsx`, `ReportsClient.tsx`, `time-tracked/page.tsx`, `LeaveEmployeeView.tsx`, `LeaveAdminView.tsx`, `leave/page.tsx`, `documents/page.tsx`, `OrgTeamView.tsx`, `profile/page.tsx`, `(marketing)/privacy/page.tsx`, `(marketing)/terms/page.tsx`, `README.md`, `HANDOVER.md`

#### Verification

- `npm run typecheck` — pass
- `npm run lint` — pass (pre-existing `<img>` warnings only)
- `npm run build` — pass

**DB migrations:** None.

### Session — Phase 4 polish: semantic tokens, shared primitives, dead code removal, perf, copy ✅ (2026-07-02)

**Pushed directly to `main`** — no DB migrations.

#### 1 — Semantic danger/success tokens

- Added `--success` / `--success-soft` (light + `.dark`); refined `--danger` / `--danger-soft` to red-600/red-50 scale
- Mapped in `tailwind.config.ts` as `success` and `success-soft`
- Refactored `Badge.tsx` danger/success/error tones to use tokens
- Replaced hardcoded colors in: `TimeTrackingView.tsx`, `DeleteTimesheetControl.tsx`, `AsanaImportModal.tsx`, `login/page.tsx`, `GeneralSettingsTab.tsx`
- Removed unused `delta` prop from `StatCard.tsx`

#### 2 — Shared primitives

- `employees/controls.tsx`: `RoleSelect` + `StatusSelect` → shared `Select` (auto-submit preserved)
- `trends/TrendsClient.tsx`: superadmin org picker → shared `Select`
- `projects/ProjectsManager.tsx`: native `confirm()` → `MotionModal` archive confirm (toast unchanged)

#### 3 — Dead code removal

Deleted (verified unreferenced):
- `src/app/app/leave/LeaveOrgSelect.tsx`
- `src/app/app/settings/SettingsForm.tsx`
- `src/components/documents/AssignUserDocumentModal.tsx`

Removed from existing files:
- `DocumentStatusSelect` + `ResendEmailButton` exports in `documents/controls.tsx`
- `updateLeaveBalance` in `leave/actions.ts`
- `idleStopAndSave` stub from `TimerContext.tsx` (type + value)

#### 4 — Perf

- Removed `console.log` in `dashboard/queries.ts`
- `timesheets/log/page.tsx`: calendar events + tracking data → `Promise.all`
- `lib/time/trends.ts` `getTrendsBundle`: three queries → `Promise.all`
- `ReportsClient.tsx` `reload()`: personal + org fetches → `Promise.all`

#### 5 — Copy consistency

- organisation → organization: `TrendsClient.tsx`, `TrendsCharts.tsx`, `GeneralSettingsTab.tsx`, `AsanaImportModal.tsx`
- admin → Manager: `LandingPage.tsx`, `AuditLogViewer.tsx` (`roleLabel()`)
- `PlatformMembersAudit.tsx`: PageHeader title "Members", removed duplicate description paragraph
- Removed placeholder Plan card from `OrgApprovalSettingsTab.tsx`

#### 6 — Functional polish

- `ApprovalControls.tsx`: approve success toast (matches list view)
- `FloatingTimer.tsx`: billable toggle in expanded panel; `TimerContext` exposes `updateBillable`
- `TrendsClient.tsx`: employee table keys by `e.id` (fallback `${e.name}-${index}`)
- `DashboardCharts.tsx`: tooltip `borderRadius` 12 → 8
- `trends.ts`: `employeeRows` now includes stable `id`

#### Files touched

Modified: `globals.css`, `tailwind.config.ts`, `Badge.tsx`, `TimeTrackingView.tsx`, `DeleteTimesheetControl.tsx`, `AsanaImportModal.tsx`, `login/page.tsx`, `StatCard.tsx`, `GeneralSettingsTab.tsx`, `employees/controls.tsx`, `TrendsClient.tsx`, `TrendsCharts.tsx`, `ProjectsManager.tsx`, `documents/controls.tsx`, `leave/actions.ts`, `TimerContext.tsx`, `FloatingTimer.tsx`, `dashboard/queries.ts`, `timesheets/log/page.tsx`, `lib/time/trends.ts`, `ReportsClient.tsx`, `LandingPage.tsx`, `AuditLogViewer.tsx`, `PlatformMembersAudit.tsx`, `OrgApprovalSettingsTab.tsx`, `ApprovalControls.tsx`, `DashboardCharts.tsx`, `README.md`, `HANDOVER.md`

Deleted: `LeaveOrgSelect.tsx`, `SettingsForm.tsx`, `AssignUserDocumentModal.tsx`

#### Verification

- `npm run typecheck` — pass
- `npm run lint` — pass (pre-existing `<img>` warnings only)
- `npm run build` — pass

**DB migrations:** None.

### Session — Init audit: env, build verify, handover merge ✅ (2026-07-06)

- **Env:** `vercel link` + `vercel env pull .env.local`; `ASANA_REDIRECT_URI` added to `.env.local.example`
- **Build:** typecheck, lint, build — all pass
- **Handover:** Merged `CADENCE_HANDOVER.md` + `HANDOVER.md` into single `HANDOVER.md`; deleted `CADENCE_HANDOVER.md`
- **Security:** Code/migration cross-check; Supabase MCP live queries blocked (permission denied)

### Session — Full init + security + prod QA ✅ (2026-07-06)

- Handover merge, env init, F4 migration backfill
- MCP: wrong org → reconnected to Cadence `irybkcryeywmwpcmhlaa`
- Live exploit battery passed; W1 `timesheet_id` nullable applied live
- Prod QA 9/9: `scripts/qa-prod-api-webhook.mjs`
- Pushed `main` @ `c94347c`

