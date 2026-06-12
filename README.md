# Cadence

**Time, tracked with rhythm.**

Cadence is a premium, multi-tenant SaaS timesheet portal for modern teams. Employees log time in-app (weekly Mon–Sun timesheets, start/end per day, project + billable); admins review and approve with rate snapshots locked at approval time; pay advices and contractor invoices are generated as PDFs and emailed automatically. Leave management, employee onboarding, official document signing, and in-app notifications round out a full people-ops workflow — all scoped per organization with role-based access and a complete audit trail.

**Live:** [https://cadence-eta-five.vercel.app](https://cadence-eta-five.vercel.app)

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
- Weekly submission (Mon–Sun): log time at `/app/timesheets/log` with auto-save via Supabase browser client (RLS-scoped)
- Seven-day view (weekends optional); submit gate: 5 days logged or 40 hours; overtime flagged for manager review
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
- **Token refresh:** automatic refresh when access token expires (5-minute buffer)
- **Deferred:** linking imported Asana projects to timesheet entries (next session)

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

## License

Private — all rights reserved.
