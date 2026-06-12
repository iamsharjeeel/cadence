# CADENCE — Project Handover

A complete brief to continue this project in a fresh chat or Cursor session. Paste this in full.

---

## What we're building
**Cadence** — a premium, multi-tenant SaaS timesheet portal. Employees log time in-app (start/end, project, description, billable); admins approve period timesheets. Approved data will later be pushed to a "CFO Claude Agent" via webhook (deferred). Tagline: "Time, tracked with rhythm."

## Stack
- **Frontend/host:** Next.js 14 (App Router, TypeScript, `src/`) on Vercel
- **Backend:** Supabase (Postgres + Auth + Storage + RLS) via `@supabase/ssr`
- **Motion:** GSAP (Three.js dropped — premium feel achieved with CSS + GSAP)
- **Charts:** recharts (teal primary series, muted secondary)
- **Build agents:** Cursor Composer (primary going forward), Claude Code (used for Phases 1–2)
- **Package manager:** npm

## Live infra
- **Supabase project URL:** `https://irybkcryeywmwpcmhlaa.supabase.co` (region: Singapore)
- **Vercel URL:** `https://cadence-eta-five.vercel.app` (no custom domain yet)
- **GitHub repo:** `cadence` (private, `iamsharjeeel/cadence`)
- **Google OAuth:** configured — redirect URI `https://irybkcryeywmwpcmhlaa.supabase.co/auth/v1/callback`, JS origin `https://cadence-eta-five.vercel.app`
- **Supabase Auth URL config:** Site URL = Vercel URL; Redirect URLs include `https://cadence-eta-five.vercel.app/**`
- **Env vars (set in Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `SUPERADMIN_EMAIL` (server-only), `DOCUMENT_ENCRYPTION_KEY` (server-only), `RESEND_API_KEY` (server-only), `RESEND_FROM_EMAIL` (server-only)

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
- `profiles`: id=auth.users.id, org_id, full_name, email, role, status, rate, rate_type, currency, bank_name, bank_account_name, bank_account_number (encrypted), bank_bsb_swift (encrypted), tax_id, address, payment_terms_days, created_at
- `audit_log`: id, org_id, actor_id, action, entity, payload jsonb, created_at
- `timesheets`: id, org_id, employee_id, period_start, period_end, status (draft|submitted|approved|rejected), raw_file_path (legacy upload path), rejection_note, approved_at, approved_by, rate_snapshot, rate_type_snapshot, currency_snapshot, calculated_total, created_at, updated_at
- `timesheet_rows`: id, timesheet_id, org_id, row_date, hours, project, description, billable, created_at — **legacy** (pre–Phase 7 uploads); kept for historical rows
- `projects`: id, org_id, owner_id, name, color, is_org_wide, is_active, created_at — org-wide or personal projects for time entry
- `time_entries`: id, org_id, employee_id, timesheet_id, project_id, entry_date, start_time, end_time, is_overnight, total_hours, description, billable, created_at, updated_at — in-app time logging (replaces upload flow)
- `webhook_deliveries`: id, org_id, timesheet_id, payload jsonb, status (pending|delivered|failed), attempts, last_attempted_at, delivered_at, created_at
- `documents`: id, org_id, timesheet_id, employee_id, type (pay_advice|invoice), status (draft|in_progress|verified|corrections_needed), document_number, gst_enabled, gst_rate, subtotal, gst_amount, total, currency, file_path, emailed_at, generated_by, status_changed_by, status_changed_at, created_at, updated_at

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
- Employees can never self-set role/rate/status — enforced in server actions.
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

## Deferred (do not build yet)
- FX conversion layer (cross-currency summing)
- CFO Claude Agent webhook activation (seam exists, just dormant)
- DOCX → PDF server-side conversion on Vercel (DOCX shows download + acknowledge flow)

## Working preferences
- Direct, snappy, concise. Minimal preamble.
- For each build phase: manual actions FIRST (numbered), then the agent prompt.
- Spell out env vars relative to Vercel + Supabase; give SQL explicitly.
- When producing specs/prompts/SQL — no direct code unless asked.
- Don't mention brand/agency names in outputs unless brought up.
