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
- Quiet-luxury design system (Mineral Teal accent, Space Grotesk + Inter)

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
- Submit gate: 5 days logged or 40 hours; overtime flagged for manager review
- Projects, trends, admin live draft visibility, time-log reminders

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

## Database migrations

Apply migrations in order via the Supabase SQL editor or `supabase db push`:

1. `supabase/migrations/20260611000000_phase4_documents.sql`
2. `supabase/migrations/20260612000000_phase5_leave_onboarding_docs.sql`
3. `supabase/migrations/20260613000000_phase6_notifications_org_logos.sql`

## License

Private — all rights reserved.
