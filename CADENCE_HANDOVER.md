Full session history: see CADENCE_HISTORY.md.

# CADENCE — Current Handover (Condensed)

## Product snapshot
- Cadence is a multi-workspace (personal + org) timesheet/time-tracking SaaS on Next.js + Supabase.
- Personal workspace is fully usable without org membership; org workspaces add approvals, team management, and org settings.
- Core time data is in `time_entries`; approvals are managed through `timesheets`.

## Stack
- Next.js 14 App Router + TypeScript
- Supabase Postgres/Auth/Storage/RLS
- Tailwind + Framer Motion
- Resend for transactional email
- Vercel deploy target

## Workspace + role model
- Active workspace is server-side (`active_workspace`) and validated against memberships.
- Effective app contexts: personal, org employee, org manager (owner/admin), superadmin.
- Navigation and data scope are workspace-context-driven.

## Time/project state
- Project sources now include:
  - Cadence projects (`projects` table; org and personal scopes)
  - Asana imported projects (`asana_imported_projects`; per-user)
- Timer writes to `time_entries` via `saveTimerEntries` and keeps existing stop→save behavior.
- Reports aggregate from `time_entries`.

## Session E outcomes (current state)

### 1) Projects/Asana Sync bug — fixed
- **Root cause:** Projects tab only queried `projects`; imported Asana projects were stored separately in `asana_imported_projects` and never merged into Projects listing.
- **Fix shipped:**
  - `/app/projects` now combines Cadence projects + imported Asana projects.
  - Synced rows are visually distinguished with an Asana badge and “Open in Asana” link.
  - Asana import/remove/disconnect/sync actions now revalidate `/app/projects`.

### 2) Draggable timer widget — fixed
- Floating timer is now draggable across viewport.
- Position is constrained to viewport bounds with edge padding.
- Position persists via localStorage key scoped by Cadence user id:
  - `cadence:timer-widget-position:v1:<userId>`
- Existing stop→timesheet save behavior is unchanged.

### 3) New Time Tracked tab — added
- New nav item + route: `/app/time-tracked`
- List view includes project, duration, start/end time, status, and notes.
- Filters include:
  - Time window (`this_week`, `this_month`, `custom`)
  - Project (`all`, specific project, no project)
- Empty state uses shared `EmptyState`.

### Session — Time tracked provenance (timer vs manual) ✅
- **`created_by_timer` column** on `time_entries` (migration `20260630000002_time_entries_created_by_timer.sql`; applied on prod — not backfilled).
- Timer stop path sets `created_by_timer = true`; manual weekly log entries remain `false`.
- **Time Tracked** tab (`/app/time-tracked`) filters on `created_by_timer = true` (not `entry_mode`).
- Summary stats on Time Tracked: timer hours vs manual hours for the filtered window (project + date filters).
- Inline **Timer** marker on timer-created entries in weekly log rows and timesheet detail.

## Important constraints and notes
- Full historical implementation decisions, migration details, and session-by-session chronology remain in `CADENCE_HISTORY.md` (verbatim archive).
- Time Tracked list shows only `created_by_timer = true` rows; pre-ship history is intentionally empty (no backfill).

## Required env/integration reminders
- Ensure Asana OAuth env vars are set:
  - `ASANA_CLIENT_ID`
  - `ASANA_CLIENT_SECRET`
  - `ASANA_REDIRECT_URI`
- Ensure encryption key and service-role env vars remain server-only.
