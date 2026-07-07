# Cadence — Audit Report

**Date:** 2026-07-07 · **Branch:** `claude/repo-audit-thinking-log-xgz6eu` · **Scope:** initialization, testing/debug, code audit, security review of the whole repository (338 TS/TSX files, 24 SQL migrations).

**Method:** whole-repo fan-out with Sonnet worker agents across seven domains, every High/Critical finding then verified by hand (refute-first: read the cited code, construct the trigger, look for the guard). The method narrative is in [`THINKING_LOG.md`](./THINKING_LOG.md). Findings below are marked **CONFIRMED** (I verified the code path myself), **PLAUSIBLE** (logic is real; full exploit/reachability not proven), or noted as **by-design**. Nothing was verified by exploiting the live database — code and SQL inspection only.

---

## Executive summary

The application is disciplined: it builds clean (typecheck + lint + build all green, matching CI), has no committed secrets, keeps the RLS-bypassing service-role client strictly server-side, and **every finding from the prior `SECURITY_AUDIT.md` (C1, C2/H1, M1, M2, L1, L2, W1, F4) is still fixed** — no regressions.

The pass nonetheless surfaced **one critical cross-tenant vulnerability** (forgeable API keys), a **server-side SSRF**, and a cluster of **hour/leave math bugs** that silently corrupt paid time and leave balances. Counts:

| Severity | Count | Headline items |
|---|---|---|
| Critical | 1 | Forgeable `api_keys` row → cross-tenant read/write |
| High | 6 | SSRF; 24h phantom shift; reports drop overnight hours; leave half-day under-count; timer "stop & start" dead; duplicate invoice numbers |
| Medium | ~10 | Schema-vs-live drift; XSS via .docx; unchecked export queries; npm advisories; missing tenant indexes; org-admin can mint co-owner |
| Low | ~12 | Non-constant-time secret compare; per-instance rate limit; missing pagination; fire-and-forget webhooks; modal-portal violations; etc. |

Recommended order of attention: **SEC-1 (critical) → SEC-2 (SSRF) → the hour/leave correctness bugs (they touch payroll) → schema drift → the rest.**

---

## Critical

### SEC-1 — Authenticated user can forge an API key scoped to any org (cross-tenant read/write) · CONFIRMED
**Where:** `supabase/migrations/20260701000001_f4_api_keys_webhook_endpoints.sql:24` (RLS policy); `src/lib/api-auth.ts`; `src/lib/api-keys/crypto.ts`; `src/app/api/v1/*/route.ts`.

**Chain (each link verified by reading the source):**
1. `api_keys_insert_own` is `for insert with check (user_id = auth.uid())` — it never validates `org_id`. `org_id` is a nullable FK with no trigger tying it to `memberships`.
2. The L1 hardening loop (`20260706000001_menu_abc_features.sql`) revokes insert/update/delete **from `anon` only** — the `authenticated` role keeps INSERT, so a logged-in user can write `api_keys` directly through PostgREST/supabase-js.
3. `hashApiKey` is unsalted `sha256(key)` — an attacker can pick a key `K` and compute `key_hash` client-side.
4. `validateApiKey` looks the row up with the admin client and returns `orgId` from the row with **no live membership check**.
5. Every `/api/v1/*` handler scopes its admin-client queries by that `ctx.orgId`.

**Failure scenario:** attacker (any signed-up user) inserts `api_keys {user_id: self, org_id: <victim org>, key_hash: sha256(K), permission: 'full'}` via PostgREST (RLS passes — `user_id = auth.uid()`), then calls `GET /api/v1/members|projects|time-entries` and `POST /api/v1/time-entries` with `Authorization: Bearer K`. Result: full read of the victim org's members (names + emails), projects, and time entries, plus forged writes.

**Fix:** add `WITH CHECK` / `USING` clauses that require `org_id IS NULL OR org_id IN (select org_id from memberships where user_id = auth.uid())` on the insert **and** update policies (and revoke the `authenticated` table grant in favour of the app's Server Action path). Defence in depth: re-validate membership inside `validateApiKey`, and consider an HMAC-keyed hash instead of bare SHA-256. Confirm the fix with a controlled test in a scratch org — do not test against real tenants.

---

## High

### SEC-2 — SSRF via webhook endpoint URL (with response reflection) · CONFIRMED
**Where:** `src/lib/webhooks/actions.ts:31` (`isValidUrl`), `src/lib/webhook-dispatcher.ts:61` (`fetch`).
`isValidUrl` accepts `http://` or `https://` to **any** host — no block on `localhost`, private ranges, or the cloud-metadata IP `169.254.169.254`. The dispatcher then fetches that URL server-side and stores up to 500 bytes of the response in `webhook_deliveries.response_body`, which the org admin can read back. An org owner/admin (a role any user can self-grant via `create_organization`) can point a webhook at internal infrastructure and exfiltrate the response.
**Fix:** allowlist `https://` only, resolve the host and reject loopback/private/link-local ranges (re-checking after DNS to avoid rebinding), and don't reflect response bodies for non-2xx internal targets.

### BUG-1 — Identical start/end time is counted as a 24-hour shift · CONFIRMED
**Where:** `src/lib/time/validation.ts:41` (`isOvernightShift` uses `<=`).
`isOvernightShift("09:00","09:00")` returns `true`, so `durationHours` wraps to **24h**. No code path rejects `start === end` for a `time_range` entry, so the phantom day flows into week stats, the submit gate, and `calculated_total × rate` at approval — silently paying for a full day never worked.
**Fix:** change `<=` to `<`, and reject `start === end` at persist time.

### BUG-2 — Reports read the forbidden generated column and drop overnight/24h entries · CONFIRMED
**Where:** `src/lib/reports/queries.ts:110,128` (and `getOrgReport` ~189,230).
Reports `select ... total_hours` straight from the row and do `if (h <= 0) continue`. `total_hours` is the DB generated column that is **negative** for overnight entries and **0** for a 24h decimal entry — exactly what `CLAUDE.md` warns never to read. Every other aggregation path recomputes via `durationHours`. Effect: overnight and full-day-decimal hours vanish from Reports (totals, billable, by-project, by-member, utilization) with no indication.
**Fix:** recompute hours from `entry_mode`/`start`/`end`/`decimal_hours` like the other paths; never sum `total_hours` directly.

### BUG-3 — Leave "Half day" records 0.5 days for a multi-day range · CONFIRMED
**Where:** `src/lib/leave/days.ts:19`; reachable via `src/app/app/leave/RequestLeaveModal.tsx` (Half-day checkbox stays active with independent start/end dates).
`countBusinessDays(start, end, halfDay)` returns a flat `0.5` whenever `halfDay` is set, ignoring the range. Selecting Mon–Fri + Half day records `days_requested = 0.5`, under-deducting the balance by 4.5 days.
**Fix:** restrict half-day to single-day requests (or compute `count - 0.5`), and validate server-side in `leave/actions.ts`.

### BUG-4 — "Stop and start new" never starts the new timer · CONFIRMED
**Where:** `src/contexts/TimerContext.tsx:169,187`; `src/components/timer/FloatingTimer.tsx:434`.
The conflict handler calls `stopTimer()` (which sets `pendingStart.current = false`) **before** `confirmStopAndStart()` (which only calls `beginRunning()` if that flag is still `true`). The new timer is never started — the user's intent to switch projects is silently dropped.
**Fix:** don't clear `pendingStart` in `stopTimer`, or have `confirmStopAndStart` start unconditionally.

### DATA-1 — `next_document_number()` has a max+1 race; no uniqueness on `document_number` · CONFIRMED (logic)
**Where:** `supabase/migrations/20260611000000_phase4_documents.sql:40`.
The function computes `max(...) + 1` with no `FOR UPDATE`/advisory lock, and `documents.document_number` has no unique constraint. Concurrent or batched pay-advice/invoice generation can mint duplicate document numbers — a bookkeeping-integrity failure with no DB backstop.
**Fix:** add a unique index on `(org_id, type, document_number)` (or use a sequence) and lock/serialize in the function.

---

## Medium

| ID | Finding | Where | Status |
|---|---|---|---|
| DATA-2 | **Migration ≠ live schema.** Committed migration declares `time_entries.total_hours` as a plain writable column + a real `is_overnight` column with `CHECK (is_overnight or end_time > start_time)`; live schema (`src/types/db.ts`) has `total_hours` **generated** and **no** `is_overnight`. A DB built fresh from `supabase/migrations/` rejects every overnight entry and won't auto-compute hours. There is also **no baseline migration** — the 24 files reference tables/enums/functions never created in-repo. | `supabase/migrations/20260616000000_phase7_time_tracking.sql:26-33` vs `src/types/db.ts:1341` | CONFIRMED |
| SEC-3 | **Stored XSS via .docx preview.** `mammoth.convertToHtml()` output is injected via `dangerouslySetInnerHTML` with no sanitizer; the viewer is reused for admin preview of *other users'* uploads (cross-privilege). No DOMPurify in deps. | `src/components/documents/UserDocumentViewer.tsx:80` | CONFIRMED (code); exploitability medium |
| BUG-5 | **`hours=24` zeroes the entry.** `decimalHoursToEndTime(24)` → `"00:00"` = start, so generated `total_hours = 0` and the day is dropped by BUG-2's reports. Validation allows exactly 24. | `src/lib/time/decimal-hours.ts:24`; `src/app/api/v1/time-entries/route.ts` | CONFIRMED |
| API-1 | **Export routes swallow DB errors.** `const { data } = await query` discards `error`; a failed query returns an empty CSV with HTTP 200 — indistinguishable from "no data" (payroll/audit exports). | `src/app/api/timesheets/export/route.ts:69`; `src/app/api/audit/export/route.ts:96` | CONFIRMED |
| SEC-4 | **Org admin (not owner) can mint an `owner` invite** → co-owner escalation within the same org, without the owner's consent. | `supabase/migrations/20260628000000_...rls_rewrite.sql:411`; `accept_invite()` | PLAUSIBLE |
| SEC-5 | **`npm audit`: 4 high + 1 moderate** — `next` (multiple DoS/SSRF/XSS advisories at pinned version), `glob` (via `eslint-config-next`), `postcss`. Fix requires a major `next` bump. | `package-lock.json` | CONFIRMED |
| PERF-1 | **65 `auth_rls_initplan`** RLS policies re-evaluate `auth.*()` per row (wrap in `(select …)`); **36 unindexed FK columns**, including the `org_id` tenant-scoping column on 11+ tables. Live-advisor confirmed. | Supabase advisor; `supabase/migrations/*` | CONFIRMED |
| SEC-6 | **Function `search_path` mutable** on `sync_timesheet_total_entry_hours` and `get_org_admin_ids`; several `SECURITY DEFINER` helpers callable by `anon`/`authenticated` via RPC; public `org-logos` bucket allows listing. | Supabase security advisor | CONFIRMED (live) |
| BUG-6 | **`isoWeekLabel` operator precedence:** `1 + Math.floor(…) / 7` divides after flooring, yielding fractional week labels (e.g. `2026-W10.857…`) in DST-observing timezones. | `src/lib/time/periods.ts:64` | CONFIRMED |
| API-2 | **No batch cap** on `documents/generate` `timesheet_ids` — thousands of sequential PDF+email ops per request risk a serverless timeout mid-batch (partial, non-resumable). | `src/app/api/documents/generate/route.ts:64` | CONFIRMED |

---

## Low (summary)

- **CRYPTO/AUTH hygiene:** `CRON_SECRET` compared with `!==` (not constant-time) — `src/app/api/cron/webhook-retries/route.ts:11`; in-memory rate limiter is per-serverless-instance, not global — `src/lib/rate-limit.ts`; webhook HMAC secret stored plaintext while OAuth tokens are AES-256-GCM encrypted — `src/lib/webhooks/actions.ts:128`; 16-char minimum on `DOCUMENT_ENCRYPTION_KEY` is a low entropy floor — `src/lib/asana-crypto.ts:11`.
- **Integrations robustness:** webhook dispatch is `void`-fire-and-forget with no `waitUntil()` (deliveries can be dropped on serverless freeze) — `src/lib/invites.ts:59`; no timeouts on Asana/Google OAuth `fetch` calls — `src/lib/asana/config.ts:56`, `src/lib/google-calendar/connection.ts:96`; `JSON.parse`/`res.json()` on external responses without try/catch — `src/lib/google-calendar/api.ts:77`; rotated Asana refresh token never persisted — `src/lib/asana/connection.ts:168`.
- **API surface:** no pagination on `GET /api/v1/members` and `/api/v1/projects` — `src/app/api/v1/{members,projects}/route.ts`; state-changing `google-calendar/disconnect` has no explicit CSRF/Origin check (bounded to own account).
- **UI/state:** workspace-switch overlay can stick if you switch while already on `/app/dashboard` — `src/components/app/WorkspaceSwitcher.tsx:152`; `OrgSettingsContext.refresh()` and the personal-timesheet auto-lock callback lack the request-sequence guard used elsewhere — `src/contexts/OrgSettingsContext.tsx:38`, `src/app/app/timesheets/TimeTrackingView.tsx:390`; three overlays don't portal to `document.body` (render off-center under `PageTransition`) — `UserDocumentViewer.tsx`, two inline dialogs in `TimeTrackingView.tsx`.
- **Latent:** `getOrgReport(orgId,…)` trusts a caller `orgId` without `trustOrgScope` (safe today — call sites pass server-derived ids; recurrence of the L2 pattern) — `src/lib/reports/queries.ts:182`.
- **Lint:** two `<img>`-instead-of-`next/image` warnings — `GeneralSettingsTab.tsx:175`, `OrgLogo.tsx:24`.
- **Style/history:** unrelated `documents.timesheet_id` change bundled into the org-invites migration — `20260619000000:60`.

---

## Testing & debug

- **CI contract runs green locally:** `npm run typecheck` (exit 0, `strict`), `npm run lint` (exit 0, 2 warnings), `npm run build` (exit 0, all routes compile). The tree is healthy.
- **No automated test suite exists** — no runner, no test files. CI is `typecheck → lint → build` only. This is the single biggest testing gap. *Recommendation (not implemented, per scope):* add Vitest and start with the pure logic that this audit shows is fragile — `src/lib/time/*` (overnight/duration/week math — would have caught BUG-1, BUG-5, BUG-6), `src/lib/leave/days.ts` (BUG-3), and the zod schemas in `src/lib/validation.ts`.
- **QA scripts not run, by design:** `scripts/qa-prod-api-webhook.mjs` and `scripts/live-db-audit.mjs` require a real `.env.local` (absent here) and touch **production** (the former POSTs to the live API and webhook.site; the latter attempts anon `insert`s against the live DB as RLS probes). Running them needs credentials and intent the audit doesn't have. They verify: API-key auth on `/api/v1/*`, the webhook signature/retry seam, and that RLS blocks anon writes on sensitive tables.

## Prior-audit regression check — all clear

Each tracked finding in `SECURITY_AUDIT.md` was mapped to its fix and the code re-read: **C1** (profiles self-escalation: column-grant reset + trigger — present), **C2/H1** (legacy `ts_read`/`ts_upload` storage policies dropped), **M1** (no `authenticated` INSERT on `audit_log`), **M2** (`timesheet_rows` policies keyed to parent-timesheet ownership), **L1** (anon write grants revoked), **L2** (`trustOrgScope` wired into all four original call sites), **W1** (`webhook_deliveries.timesheet_id` nullable), **F4** (api_keys/webhook_endpoints ownership policies). All **still fixed**. (Note: L2's *pattern* recurs unguarded in the newer `getOrgReport` — see Low/latent above; and F4's api_keys policy is the subject of SEC-1, which the original audit's live test did not cover.)

## By-design (noted, not defects)

- **Superadmin cross-tenant read** on sensitive tables is intentional platform oversight; the residual risk is concentration — compromise of that one account = full-platform read. Consider a break-glass/audit gate.
- **Supabase anon key + URL are `NEXT_PUBLIC_`** by design; RLS is the real boundary. No secret-named env var is client-exposed.
- **Leaked-password protection disabled** (Supabase advisor) is moot — auth is Google OAuth only.
