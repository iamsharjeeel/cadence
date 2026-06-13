# CADENCE — Project Handover

A complete brief to continue this project in a fresh chat or Cursor session. Paste this in full.

---

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
- **Google OAuth:** configured — redirect URI `https://irybkcryeywmwpcmhlaa.supabase.co/auth/v1/callback`, JS origin `https://cadence-eta-five.vercel.app`
- **Supabase Auth URL config:** Site URL = Vercel URL; Redirect URLs include `https://cadence-eta-five.vercel.app/**`
- **Env vars (set in Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `SUPERADMIN_EMAIL` (server-only), `DOCUMENT_ENCRYPTION_KEY` (server-only), `RESEND_API_KEY` (server-only), `RESEND_FROM_EMAIL` (server-only), `ASANA_CLIENT_ID` (server-only), `ASANA_CLIENT_SECRET` (server-only), `ASANA_REDIRECT_URI` (server-only — `https://cadence-eta-five.vercel.app/api/asana/callback`)

## Key product decisions (all locked)
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
- Employees can never self-set role/status — enforced in server actions. Rate is self-editable on Profile.
- Audit log on: approval, role/rate/status change, org creation, timesheet submission.
- Reject `.xlsm`/macros; validate MIME + extension + size (max 10MB).
- CSV export: re-check admin/superadmin role server-side before streaming.
- Never expose unapproved timesheets in export.
- Dashboard aggregates: admin queries always filter by `profile.org_id`; superadmin org drill-down validates org server-side (never trust client `org_id` for admin scope).

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

## Deferred (do not build yet)
- Full employee account deletion / GDPR hard-delete (membership removal only ships this session)
- FX conversion layer (cross-currency summing)
- CFO Claude Agent webhook activation (seam exists, just dormant)
- DOCX → PDF server-side conversion on Vercel (DOCX shows download + acknowledge flow)

## Working preferences
- Direct, snappy, concise. Minimal preamble.
- For each build phase: manual actions FIRST (numbered), then the agent prompt.
- Spell out env vars relative to Vercel + Supabase; give SQL explicitly.
- When producing specs/prompts/SQL — no direct code unless asked.
- Don't mention brand/agency names in outputs unless brought up.
