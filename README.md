# Cadence

**Time, tracked with rhythm.**

Cadence is a premium, multi-tenant SaaS timesheet portal for modern teams. Employees log time in-app (weekly Mon–Sun timesheets, start/end per day, project + billable); admins review and approve with rate snapshots locked at approval time; pay advices and contractor invoices are generated as PDFs and emailed automatically. Leave management, employee onboarding, official document signing, and in-app notifications round out a full people-ops workflow — all scoped per organization with role-based access and a complete audit trail.

**Live:** [https://cadence-eta-five.vercel.app](https://cadence-eta-five.vercel.app)

## Workspace model (Track C)

Cadence is **personal-by-default + true multi-workspace**:

- **Every user is a personal account.** The full solo product — time tracking, projects, trends, leave, documents, profile — works with no organization and no approval layer (solo = nobody to approve). Personal data belongs to the **user** (`org_id IS NULL`, owned via `employee_id`/`user_id`/`owner_id`), not an org.
- **Organizations are many-to-many.** Membership lives in a `memberships` table (`user_id`, `org_id`, `role` ∈ owner/admin/employee). A solo user has zero memberships; a user may belong to many orgs, each with its own role.
- **Self-serve org creation.** Any user can create an organization from personal space and becomes its **owner** (`create_organization()` RPC — atomic org + owner membership). No superadmin involved.
- **Active workspace.** A per-user server-side context (`active_workspace` table) decides "am I acting as personal, or as org X?". It drives **both** the UI (workspace switcher in the sidebar) and the database scope: `auth_org()` resolves the active workspace **validated against your memberships** — you can only ever scope to an org you actually belong to, and a forged/stale claim resolves to personal (no access). Switching always goes through `set_active_workspace()`, which refuses a non-member org.
- **Invite-only joining.** Org owners/admins invite by email; the invitee accepts (`accept_invite()`) to get a membership with the assigned role. There is **no domain auto-attach** — signing up never lands you in an org by email domain.
- **Superadmin** is a platform-oversight layer **outside** the workspace structure: it owns nothing, is in no org, and retains cross-tenant read for audit/support.

Isolation is enforced at the database layer (RLS keyed on the validated active workspace) and re-verified as real `authenticated` sessions; see `SECURITY_AUDIT.md`. **The multi-workspace model is live in production** (merged to `main`; post-deploy isolation re-verification passed on the production database).

## Tech stack

- **Next.js 14** — App Router, TypeScript, `src/` directory
- **Supabase** — Postgres, Auth (Google OAuth), Storage, RLS via `@supabase/ssr`
- **Framer Motion** — app shell transitions, modals, landing animations
- **Three.js** — landing hero particle field
- **Tailwind CSS** + **next-themes** — light/dark, CSS-variable design tokens
- **recharts** — dashboard charts
- **@react-pdf/renderer** — serverless PDF generation
- **Resend** — transactional email with PDF attachments
- Deploy target: **Vercel** · Package manager: **npm**

## Key features

### Phase 1 — Foundation
- Multi-tenant orgs with domain-gated Google OAuth
- Three roles: superadmin, admin, employee
- Profile and employee management with audit logging
- Quiet-luxury design system (Warm Gold accent, Space Grotesk + Inter, true-black dark mode)

### Phase 2 — Timesheets
- Three-method upload pipeline (file / paste / Google Sheet)
- Fuzzy header mapping with per-org localStorage persistence
- Live validation, period overlap guard, submit/approve/reject workflow
- Rate and currency snapshot at approval; dormant webhook seam

### Phase 3 — Dashboard & export
- Role-aware dashboards with charts and activity feed
- Bulk approve, CSV export, superadmin org drill-down
- Start/end time resolution and payroll format auto-detection

### Phase 4 — Documents
- Pay advice and contractor invoice PDF generation
- Encrypted banking fields, Resend email delivery
- Document status tracking and re-send

### Phase 5 — Leave, onboarding & document hub
- Leave balances, calendar, request/approve workflow
- Five-step employee onboarding wizard
- Official documents: upload, e-sign, acknowledge

### Phase 6 — Performance, notifications & settings
- Instant client-side navigation with progress bar and optimistic active states
- In-app notification bell with 60s polling
- Org settings: logo upload, domain management, danger zone
- Audit log viewer with CSV export
- Profile completeness indicator
- Enhanced landing page

### Phase 7 — In-app time tracking
- Weekly submission (Mon–Sun): log time at `/app/timesheets` (employees) or `/app/timesheets/log` with auto-save via Supabase browser client (RLS-scoped)
- **Personal (no-org) users** can log time in personal workspace: entries and timesheets save with `org_id = null`; no submit-for-approval flow (entries persist as drafts). Switching into an org via the workspace switcher scopes new entries to that org and restores the approval workflow.
- Seven-day view (weekends optional); submit gate (org context only): 5 days logged or 40 hours; overtime flagged for manager review
- Draft rows persist only with valid start/end; overlap guard excludes self and invalid DB rows
- Branded **TimePicker** and **DatePicker** components (gold accent, Framer Motion popovers) replace native time/date inputs app-wide
- SSR prefetch on timesheet log pages for near-instant first paint (no client waterfall on load)
- Projects, trends, admin live draft visibility, time-log reminders

### Phase 8 — Invites, roles & onboarding
- **Owner** role (`owner | admin | employee | superadmin`); UI labels `admin` as “Manager”
- **Invite flow:** owners/managers send email invites from `/app/employees`; Resend delivery; invite redeemed on Google OAuth sign-in
- **Pending invites panel** on Employees — sent invites appear immediately; 30s poll while invites are pending
- **Remove from org:** owners/managers remove membership (clears `profiles.org_id` + pending invites; does not delete accounts)
- **No pending gate:** new sign-ups land **active** immediately (invite redemption or domain match); onboarding wizard when incomplete
- **Suspended-only block:** middleware and auth redirect suspended users to login with an error banner

### Phase 8b — Decimal hours & test-account tooling
- **Decimal hours entry:** per-row toggle (Time range vs Total hours) on weekly log grid; synthetic `00:00` + offset times feed generated `total_hours`
- **Test-account cleanup:** `supabase/scripts/unstick_owner_test_account.sql` and `scripts/unstick-test-account.mjs`

### Phase 9 — Asana OAuth + project import
- **Per-user OAuth:** each Cadence user connects their own Asana account (not org-level)
- **Profile → Connected accounts:** Connect / Disconnect Asana; tokens encrypted at rest (AES-256-GCM via `DOCUMENT_ENCRYPTION_KEY`)
- **OAuth callback:** `GET /api/asana/callback` (registered redirect URI in Asana + Vercel)
- **Project import:** browse workspaces/projects from Asana, import into personal `asana_imported_projects` list
- **Entry tagging:** optional Asana project picker on each time entry row (separate from Cadence `projects`)
- **Dashboard connect banner** when Asana is not connected; official Asana logo mark across UI
- **Reconnect notification:** opportunistic token health check on dashboard load
- **Token refresh:** automatic refresh when access token expires (5-minute buffer)

### Stabilization — scopes, rate, team, collapse
- **Asana scopes:** `ASANA_REQUIRED_SCOPES` in `src/lib/asana/config.ts` (`projects:read`, `workspaces:read`); reconnect prompt on insufficient scope; existing tokens need one reconnect
- **Self-service rate:** Profile → Employment rate editable; audit `source: self|admin`
- **Unassigned users:** org Team query already scoped; superadmin sees unassigned with Assign-to-org action
- **Time entry collapse:** explicit **Save** collapses saved rows to summary; autosave persists silently; click summary to expand

### Phase 9b — Asana picker polish
- **Picker layout:** Asana project leads the row (same visual weight as Cadence dropdown); Cadence project second; picker hidden when not connected
- **Custom listbox:** imported-project dropdown clamped to `max-h-60` with scroll (fixes native `<select>` overflow)
- **Profile hash scroll:** `/app/profile#section-connected` scrolls to Connected accounts (`ProfileHashScroll` + `scroll-mt-20` on section cards)
- **Bell badge:** unread `asana_reconnect_required` shows Asana icon on the notification dot (coral mark, distinct from count badge)
- **Project links:** collapsed entry tag + expanded “Open in Asana” use `https://app.asana.com/0/{asana_project_gid}` (gid already stored — no migration)
- **Collapsed sync:** “Synced …” timestamp on collapsed entry summary when an Asana project is tagged
- **Empty state:** “No projects imported” shows count of Asana projects available to import
- **Disconnect confirm:** modal before disconnect (clears imported project list)

### Phase 9c — Entry row alignment, collapse, summary
- **Dropdown parity:** shared `PROJECT_SELECT_CLASSES` + fixed 18px leading slot; Asana sync metadata moved below grid (`AsanaProjectPickerMeta`)
- **Collapse on Save only:** autosave no longer collapses; loaded entries still start collapsed; Save = persist + collapse
- **Collapsed summary precedence:** Cadence-only, Asana-only (no erroneous "No project"), or both shown together; "Synced …" subordinate to Asana tag

### Phase 10 — Google Calendar integration
- **Per-user OAuth:** Google Calendar `calendar.readonly` scope; tokens encrypted at rest (`cadence-gcal-v1` salt)
- **Profile → Connected accounts:** side-by-side Asana + Google Calendar tiles; Manage modals for each integration
- **Calendar sync:** select calendars, sync events (−7 to +60 days), persisted in `google_calendar_events`
- **Leave page:** synced events as blue chips on calendar grid; event detail modal with “Add as time entry”
- **Log time:** “From calendar” suggestions per day; prefill via `?date=&prefill=` query params
- **Mobile nav:** sidebar overlay below 768px; topbar hamburger + Cadence wordmark + avatar/bell

### Light polish + dark mode (Stitch reference)
Light mode polish pass + dark mode implementation: sharp corners, hairline borders, gold-on-black stat numbers, uppercase nav labels in dark, audit action badge chips, leave balance cards with progress bars, landing hero Playfair tagline as decorative background layer, sidebar org logo block at top with "PAYROLL & HR" subtitle.

### Robustness pass — modals, dark dropdowns, profile, overnight fix
- **App-wide modal flicker eliminated:** CSS-only body scroll lock (`.modal-open` + `scrollbar-gutter: stable` — no inline `body.style.overflow` reflow), ref-counted lock for stacked modals (`src/lib/body-scroll-lock.ts`), flex-centered `MotionModal` (no translate sub-pixel shake), motion props as constants.
- **Profile → Connected accounts** moved to the top and rebuilt as inline expandable sub-sections (Asana + Google Calendar manage modals removed); inline disconnect confirm; Google account email now shown (backfilled from primary calendar).
- **Time entries:** removed `is_overnight` from all Supabase write payloads (not a real column; `total_hours` is generated) — overnight is derived client-side only.
- **Dark mode dropdowns:** native `<select>`/`<option>` and all custom listboxes respect surface tokens.
- **Hardening:** per-route `error.tsx` boundaries, request-sequence guard on the time-log loader, trends empty states, fetch-once guards, verified interval/effect cleanup. `npm run typecheck` + `npm run build` pass clean.

### Modal portal, overnight duration, client-side trends filters
- **Modals render via a portal to `document.body`** so `position: fixed` escapes transformed ancestors (the page-transition `motion.div`) — fixes off-center dialogs and hover flicker over the dimmed backdrop.
- **Overnight duration** (e.g. 23:30→00:15 = 0.75h, 22:00→02:00 = 4h) is computed with a wrapping formula everywhere hours are shown/aggregated, instead of the DB generated column (which is negative for overnight).
- **Trends filters** (time window + organization) update charts **in place** via client state + a server action — no full page reload.

### Modal fix anchored to `main` + build marker
- The modal portal fix above shipped to production but was originally on a feature branch that was **never merged to `main`** — so `main` still carried the old, broken modal. It is now merged, and the owner has confirmed the flicker/off-center bug is **resolved on the live deploy**.
- **Deploy verifiability:** `next.config.mjs` exposes the build's git commit SHA as `NEXT_PUBLIC_COMMIT_SHA`, rendered on `<body data-build="…">`. To confirm which commit is actually live:
  ```bash
  curl -s https://cadence-eta-five.vercel.app | grep -o 'data-build="[^"]*"'
  ```
  Compare the value to `git rev-parse origin/main`.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in values below
npm run dev                        # http://localhost:3000
```

`npm run build` and `npm run typecheck` should both pass clean.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | public | App origin (OAuth redirect base) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | Privileged writes |
| `SUPERADMIN_EMAIL` | server-only | Auto-promote email to superadmin on sign-in |
| `DOCUMENT_ENCRYPTION_KEY` | server-only | AES-256-GCM for bank field encryption |
| `RESEND_API_KEY` | server-only | Resend API key |
| `RESEND_FROM_EMAIL` | server-only | Sender address for document emails |
| `ASANA_CLIENT_ID` | server-only | Asana OAuth app client ID |
| `ASANA_CLIENT_SECRET` | server-only | Asana OAuth app client secret |
| `ASANA_REDIRECT_URI` | server-only | Must match Asana app registration (`…/api/asana/callback`) |
| `GOOGLE_CLIENT_ID` | server-only | Google OAuth client ID (Calendar API) |
| `GOOGLE_CLIENT_SECRET` | server-only | Google OAuth client secret |
| `GOOGLE_CALENDAR_REDIRECT_URI` | server-only | Must match Google console (`…/api/google-calendar/callback`) |

## Database migrations

Apply migrations in order via the Supabase SQL editor or `supabase db push`:

1. `supabase/migrations/20260611000000_phase4_documents.sql`
2. `supabase/migrations/20260612000000_phase5_leave_onboarding_docs.sql`
3. `supabase/migrations/20260613000000_phase6_notifications_org_logos.sql`
4. `supabase/migrations/20260614000000_security_rls_storage.sql`
5. `supabase/migrations/20260615000000_org_logos_bucket.sql`
6. `supabase/migrations/20260616000000_phase7_time_tracking.sql`
7. `supabase/migrations/20260617000000_time_entries_perf_index.sql` (optional perf index)
8. `supabase/migrations/20260619000000_org_invites_owner_role.sql` — **required for invite flow**
9. `supabase/migrations/20260620000000_time_entry_decimal_mode.sql` — **required for decimal-hours entry mode**
10. `supabase/migrations/20260621000000_asana_oauth.sql` — **required for Asana OAuth + import**
11. `supabase/migrations/20260622000000_time_entry_asana_project.sql` — **required for Asana entry picker**
12. `supabase/migrations/20260623000000_leave_types_unit.sql` — leave unit system
13. `supabase/migrations/20260624000000_google_calendar.sql` — **required for Google Calendar integration**

## Design system v2

Cadence uses a **quiet luxury** token system — parchment light mode and true-black dark mode with warm gold accents.

- **Typography:** Space Grotesk (`--font-space`) for headings and UI chrome; Inter (`--font-inter`) for body; Playfair Display (`--font-playfair`) on the landing hero only (decorative tagline)
- **Light tokens:** background `#FBFAF7`, surface `#FFFFFF`, ink `#1A1917`, accent gold `#7F560C` / mid `#C9974A`
- **Dark tokens (Stitch):** background `#0A0A08`, surface `#131310`, accent `#F7BD48`, sharp corners (0px radius), hairline borders, no card shadows
- **Light polish + dark mode:** see session note above — gold-on-black stat numbers, uppercase dark nav, audit badge chips, modal gold border in dark
- **Primitives:** CSS variables in `src/app/globals.css`, mapped in `tailwind.config.ts` — `bg-background`, `bg-surface`, `bg-surface-low`, `text-ink`, `text-muted`, `shadow-card`, `shadow-float`, `rounded-card` / `rounded-input`
- **Numeric data:** `.tabular` utility (`font-feature-settings: "tnum"`)

## License

Private — all rights reserved.
