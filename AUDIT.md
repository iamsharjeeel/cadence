# Cadence — Codebase Audit (Phase 1)

**Date:** 2026-07-08
**Method:** Six parallel area audits (API/actions, data layer/migrations, auth/workspace, integrations/crypto, frontend, infra/deps/tests), synthesized and severity-ranked by the orchestrator. The highest-severity findings were re-verified directly against source before ranking. Findings only — no code was changed during Phase 1.
**Scope note:** This audit is additive to `SECURITY_AUDIT.md`. Its previously-remediated findings (C1/C2/H1, M1/M2, L1/L2) were re-checked and confirmed still fixed / not regressed, except where a *later* migration reintroduced a gap (see D1–D3). Those older IDs are not re-litigated here.

---

## Architecture overview

Cadence is a Next.js 14 (App Router, `src/`, TypeScript) multi-tenant SaaS timesheet portal on Vercel, backed by Supabase (Postgres + Auth + Storage + RLS via `@supabase/ssr`). Tenancy is **personal-by-default + many-to-many org memberships + a server-side `active_workspace`**. Two auth paths exist: (1) **session auth** — `updateSession()` in middleware re-validates the JWT via `auth.getUser()` and does coarse routing (login/suspended/onboarding); `getWorkspaceContext()` then resolves an `effectiveProfile` whose role/org are re-pointed at the validated active workspace, and nearly every Server Action re-derives this and re-checks role/membership before mutating. (2) **API-key auth** — `validateApiKey()` hashes a bearer token (SHA-256 over 256-bit random) and looks up `api_keys` via the service-role client, independent of the session system. Almost all privileged writes use the service-role admin client with the authorization decision made in app code first; RLS is the backstop. Isolation at the DB layer is keyed on `auth_org()`/`auth_workspace_role()` (SECURITY DEFINER) validated against `memberships`.

**Overall posture:** The session/workspace auth model and the Track-C tenancy cutover are, on the whole, carefully built — cross-tenant IDOR is consistently blocked in app code, OAuth CSRF/state handling and at-rest AES-256-GCM encryption are correct, and the earlier SECURITY_AUDIT criticals hold. The serious problems cluster in three places: **(a) RLS WITH CHECK regressions introduced by the Track-C2 rewrite that let employees self-approve financial records via a direct DB call**, **(b) a tenant-admin SSRF in the webhook system with a response read-oracle**, and **(c) over-exposure of banking/tax PII to the client**. Plus a long tail of correctness bugs (broken month navigation, float money math, timer data loss), a stale dependency with open CVEs, missing security headers, and zero automated tests.

---

## Severity-ranked summary

| ID | Sev | Area | Finding | Status |
|----|-----|------|---------|--------|
| D1 | 🔴 Critical | Data/RLS | `timesheets_update` WITH CHECK omits status → employee self-approves own timesheet (payroll fraud) | ✅ Resolved (`20260708000000`) |
| D2 | 🔴 Critical | Data/RLS | `documents_update` WITH CHECK omits status → employee self-verifies own pay-advice/invoice | ✅ Resolved (`20260708000000`) |
| I1 | 🔴 Critical | Integrations | Webhook SSRF: no private/loopback/metadata IP block + response body reflected to admin (read-oracle) | ✅ Resolved |
| D3 | 🟠 High | Data/RLS | `time_entries_update` has no status predicate → employee self-approves logged hours | ✅ Resolved (`20260708000000`) |
| F1 | 🟠 High | Frontend | Unmasked `tax_id`/`address` for every employee sent to admin on `/app/employees` load | ✅ Resolved |
| F2 | 🟠 High | Frontend | Full banking/PII profile (`select *`) serialized into every authenticated page via AppShell/Topbar | ✅ Resolved |
| A1 | 🟠 High | API | API keys keep working after owner is suspended or removed from org | ✅ Resolved |
| A2 | 🟠 High | API | `deleteTimesheet` permanently deletes `approved`/paid timesheets with no confirmation gate | ✅ Resolved |
| N1 | 🟠 High | Infra/Deps | Next.js 14.2.35 in range of 9+ security advisories; fix path is a 15.x major upgrade | Open |
| C1 | 🟠 High | Correctness | Monthly Next/Previous navigation silently no-ops for 31-day months (reproduced) | ✅ Resolved (+test) |
| C2 | 🟠 High | Correctness | Money math float-rounding cent drift in `calc.ts`/`amounts.ts` (reproduced) | ✅ Resolved |
| C3 | 🟠 High | Correctness | Timer: `end == start` treated as overnight → saves a 24h shift, skips overlap checks | ✅ Resolved |
| C4 | 🟠 High | Correctness | Official-doc sign/acknowledge lack idempotency guard → double-sign/replay | ✅ Resolved |
| D4 | 🟠 High | Data/Migrations | Migrations fail on fresh apply: `gmail_inbox` references non-existent `memberships.status`; `org_settings` calls `auth_workspace_role()` before it's defined | ✅ Resolved |
| M1 | 🟡 Medium | API | v1 rate limiter is per-instance in-memory → bypassable across lambda instances | Open |
| M2 | 🟡 Medium | Infra | No security headers (CSP, X-Frame-Options, HSTS, nosniff) anywhere | ✅ Resolved (safe set; full content-CSP deferred) |
| M3 | 🟡 Medium | Auth/Data | "Suspend all employees" kill switch + domain guard query vestigial `profiles.org_id/role` → match 0 rows | ✅ Resolved |
| M4 | 🟡 Medium | Data | `applyDefaultBalancesForOrg` queries vestigial `profiles.org_id/role` → leave-balance seeding silently does nothing | ✅ Resolved |
| M5 | 🟡 Medium | Auth | `getExpensesForWorkspace`/`getPendingExpenses`/`fetchProjectsForTimeEntry` are `"use server"` with no internal auth check | ✅ Resolved |
| M6 | 🟡 Medium | Integrations | Email HTML injection: `orgName` (invites) and `employee.full_name` (pay-advice) interpolated unescaped | ✅ Resolved |
| M7 | 🟡 Medium | Frontend | `mammoth` docx→HTML rendered via `dangerouslySetInnerHTML` with no sanitization | Open |
| M8 | 🟡 Medium | Frontend | Running-timer state not persisted → refresh/crash discards in-progress session | Open |
| M9 | 🟡 Medium | Integrations | OAuth token refresh has no locking; Asana rotates refresh tokens → race corrupts connection | Open |
| M10 | 🟡 Medium | Integrations | Webhook retry cron has no delivery claim/lock → concurrent runs double-deliver | Open |
| M11 | 🟡 Medium | Data | L2 pattern applied inconsistently: `reports/pending/trends` aggregators trust raw `orgId` arg | ✅ Resolved |
| M12 | 🟡 Medium | Frontend | Gmail inbox: `openThread` stale-response race + unhandled rejections on expired session | ✅ Resolved |
| M13 | 🟡 Medium | Frontend | `submitExpense` skips `validateCurrency()` → garbage currency codes stored | ✅ Resolved |
| M14 | 🟡 Medium | Infra/CI | CI has no `npm audit` gate and no test step | ✅ Resolved (audit step added, non-blocking until N1) |
| M15 | 🟡 Medium | Infra | `qa-prod-api-webhook.mjs` hardcodes real prod UUIDs and defaults to hitting production | ✅ Resolved (prod-write guard; UUIDs→env is a minor follow-up) |
| L1 | 🔵 Low | API/Integrations | Non-constant-time compare of `CRON_SECRET` and OAuth `state` | ✅ Resolved |
| L2 | 🔵 Low | Integrations | One shared `DOCUMENT_ENCRYPTION_KEY` for all 4 crypto domains; `.length < 16` char gate only | Open |
| L3 | 🔵 Low | Integrations | `scryptSync` re-derived per encrypt/decrypt call on hot paths (event-loop stall) | ✅ Resolved |
| L4 | 🔵 Low | Integrations | Webhook endpoints accept `http://` (cleartext payloads) | ✅ Resolved (with I1: HTTPS now required) |
| L5 | 🔵 Low | API | `documents/generate` has no batch-size cap or rate limit → email/PDF flood | ✅ Resolved (cap 50; rate limit deferred) |
| L6 | 🔵 Low | Auth | `notifyPendingTimeEntry` server action has no auth check (notification spoof/spam) | ✅ Resolved |
| L7 | 🔵 Low | Auth | `/auth/signout` has no CSRF/origin check (forced logout) | ✅ Resolved |
| L8 | 🔵 Low | Data/Perf | No index on `api_keys.user_id` / `webhook_endpoints.org_id` | ✅ Resolved (`20260708000002`) |
| L9 | 🔵 Low | Deps | Dead dependency `three` / `@types/three` (Three.js was dropped) | ✅ Resolved |
| L10 | 🔵 Low | Infra | `sync-from/to-cloud.sh` do destructive `reset --hard`/auto-commit-push with no guard | Open |
| L11 | 🔵 Low | Infra | `unstick-test-account.mjs` defaults to a hardcoded personal email | ✅ Resolved |
| L12 | 🔵 Low | Frontend/Perf | Unbounded queries (platform members, expenses) and un-virtualized 200-row lists | Open |
| L13 | 🔵 Low | Frontend/a11y | Signature canvas has no `aria-label`/typed-name fallback | ✅ Resolved (aria-label; typed fallback deferred) |
| L14 | 🔵 Low | Correctness | `decimal-hours` 24h input wraps to `00:00`/`00:00` | ✅ Resolved |

---

## Detail — Critical

### D1 — Employee self-approval of own timesheet (RLS WITH CHECK regression) 🔴
**`supabase/migrations/20260628000000_track_c2_atomic_cutover_rls_rewrite.sql:200-207`**
The `timesheets_update` `USING` clause (line 203) correctly limits an employee to rows with `status IN ('draft','rejected')`, but the `WITH CHECK` employee branch (line 206) is just `employee_id = auth.uid()` — the status predicate is gone. An org employee can therefore issue a direct Supabase REST/JS `UPDATE timesheets SET status='approved' WHERE id=<own>` with their own JWT, bypassing the app's approval Server Actions. Approved timesheets drive payroll totals and pay-advice/invoice generation. **Blast radius:** any org employee → payroll fraud, self-approval of own pay.
**Fix:** add `and status = any(array['draft','rejected'])` back into the employee branch of the `WITH CHECK`. Verified against source.

### D2 — Employee self-verification of own payroll document (RLS WITH CHECK regression) 🔴
**`supabase/migrations/20260628000000_track_c2_atomic_cutover_rls_rewrite.sql:269-276`**
Identical pattern on `documents_update`: `USING` (line 272) requires `status='draft'` for the employee branch; `WITH CHECK` (line 275) drops it. An employee can flip their own draft pay-advice/invoice to `verified`, bypassing the admin verification step. **Blast radius:** any org employee → forge verified payroll documents.
**Fix:** add `and status = 'draft'` back into the employee branch of the `WITH CHECK`. Verified against source.

### I1 — Webhook SSRF with response read-oracle 🔴
**`src/lib/webhooks/actions.ts:31-38` (`isValidUrl`), `src/lib/webhook-dispatcher.ts` (`postToEndpoint`)**
`isValidUrl` only checks that the URL parses and the scheme is `http/https` — no blocklist for loopback / RFC1918 / link-local (`169.254.169.254` cloud metadata) / DNS-rebinding, and `fetch` follows redirects by default. Worse, delivery persists the first 500 chars of the response to `webhook_deliveries.response_body` and `listWebhookDeliveries` returns the full row to the browser, so this is a *read-oracle* SSRF, not blind. **Blast radius:** any org owner/admin → read internal services and steal cloud IAM credentials from the metadata endpoint.
**Fix:** resolve the host and reject private/loopback/link-local/metadata IPs at creation *and* at each delivery (re-resolve to defeat rebinding), disable redirect-following or re-validate each hop, require `https:`, and stop returning `response_body` to the client. Verified `isValidUrl` against source.

---

## Detail — High

### D3 — Employee self-approval of own time entries 🟠
**`supabase/migrations/20260628000000_...:175-182`** — `time_entries_update` has `employee_id = auth.uid() or owner/admin` in *both* `USING` and `WITH CHECK`, with no `status` predicate. The approval workflow column (`pending_approval/approved/rejected`, added in `20260630000001`) was never given an RLS backstop, so `canApproveInOrg`/`approveTimeEntry` are app-layer-only. Any employee can self-approve logged hours via a direct call. **Fix:** gate `status` transitions to owner/admin in `WITH CHECK` (mirror the `expenses_update` pattern). Verified.

### F1 — Unmasked tax ID and home address exposed to admins 🟠
**`src/app/app/employees/OrgTeamView.tsx:265-279`** — `BankingEditor`'s `defaults` carries plaintext `tax_id` and `address` for every employee row, while `bank_account_number`/`bank_bsb_swift` are correctly `maskSensitive()`'d. All employees' tax IDs and addresses land in the initial RSC payload before the editor is opened. **Fix:** mask them like the bank fields, or fetch on-demand when the editor opens.

### F2 — Full banking/PII profile serialized into every page 🟠
**`src/lib/workspace.ts` (`getWorkspaceContext` `select("*")`), `src/components/app/AppShell.tsx`, `Topbar.tsx`** — the entire `profiles` row (bank details, tax_id, address, rate, emergency contacts) is passed through client components on every authenticated page, though the shell only uses `avatar_url`/`id`. **Fix:** build a slim `SessionProfile` (id, name, email, avatar_url) for shell/nav; keep the full profile scoped to the profile-edit page.

### A1 — API keys survive suspension / org removal 🟠
**`src/lib/api-auth.ts:17-54`** — `validateApiKey` checks only `revoked_at`/`expires_at`; it never joins `profiles.status` or re-checks current `memberships`. A suspended or removed user's key keeps working against `/api/v1/*`. **Fix:** re-verify `profiles.status='active'` (and, for org-scoped keys, live membership) per call, and/or cascade-revoke keys on suspend/remove.

### A2 — `deleteTimesheet` destroys approved/paid records 🟠
**`src/app/app/timesheets/actions.ts:418-477`** — deletes timesheets of any status including `approved`, with no confirmation param despite the docstring claiming one; cascades to `time_entries`/`timesheet_rows`/`webhook_deliveries`. **Fix:** forbid deleting `approved` (or require explicit confirmation + restrict to admin).

### N1 — Next.js 14.2.35 open advisories 🟠
**`package.json`** — `npm audit` flags 9+ GHSA advisories against 14.2.35 (cache poisoning, RSC/CSP XSS, SSRF via WS upgrade, middleware bypass, DoS) whose fixed ranges extend past 15.5.16 — none backported to 14.x. **Fix:** plan a Next 15.x upgrade; add `npm audit --omit=dev --audit-level=high` to CI. (Nested `postcss` advisory resolves with the same bump.)

### C1 — Monthly period navigation no-ops 🟠
**`src/lib/time/periods.ts:172-186` (`shiftViewPeriod`), :216-228 (`shiftPeriod`)** — both jump a fixed 14/15 days from a mid-period pivot regardless of month length. Reproduced numerically: Next/Previous on the "Month" view returns the same month for every 31-day month; `shiftPeriod` is worse. **Fix:** shift by one calendar month directly (`new Date(y, m±1, 1)`); add a unit test over all 12 months both directions.

### C2 — Money math float-rounding cent drift 🟠
**`src/lib/timesheets/calc.ts:16`, `src/lib/documents/amounts.ts:7-14`** — `Math.round(x*100)/100` mis-rounds `.xx5` boundaries (e.g. `1.005 → 1.00`), and errors compound across invoice line items. **Fix:** integer-cents arithmetic (or a decimal lib); add boundary tests.

### C3 — `end == start` saved as a 24-hour shift 🟠
**`src/lib/time/validation.ts:35-42` (`isOvernightShift` uses `<=`), `src/app/app/timesheets/time-actions.ts:158-166`** — identical start/end skips the zero-duration rejection, computes 24.0h, and skips overlap checks. **Fix:** reject `start === end` before the overnight branch, in both server and client validators.

### C4 — Official-doc sign/acknowledge missing idempotency guard 🟠
**`src/app/app/official-documents/actions.ts:221-247` (acknowledge), `:272-306` (sign)** — neither checks `status` before writing nor uses `.eq("status","pending")` on the update, so double-click/replay/two-tabs can overwrite a signature and double-fire notifications. The org-documents equivalent does this correctly. **Fix:** guard on status and make the update conditional (`.eq("status","pending")`).

### D4 — Migrations fail on a fresh apply 🟠
**`supabase/migrations/20260707000001_gmail_inbox.sql:109`** references `m.status = 'active'` but `memberships` has no `status` column (`20260627000000_...:48-56`) → the `CREATE POLICY` errors and, in a single-transaction apply, aborts the whole Gmail migration. **`supabase/migrations/20260616000001_org_settings.sql:41,49,53,61`** calls `auth_workspace_role()`, first defined 12 days later in `20260628000000`. Both break a from-scratch apply (new dev DB, CI, disaster-recovery restore); production only works because live migrations were applied in a different (MCP-managed) order. **Fix:** drop the bogus `m.status` predicate; re-order/renumber `org_settings` after the Track-C2 function definition (or guard it). Verified both against source.

---

## Detail — Medium

- **M1** `src/lib/rate-limit.ts` + `src/lib/api/v1/guard.ts` — in-memory `Map` per warm lambda; 120/min is bypassable by fanning across instances. Fix: shared store (Upstash/Redis/Supabase).
- **M2** `next.config.mjs`/`vercel.json`/`middleware.ts` — no CSP/X-Frame-Options/HSTS/nosniff/Referrer-Policy. Fix: add a `headers()` block.
- **M3** `src/app/app/settings/actions.ts:255-261` (`suspendAllEmployees`), `:100-114` (`updateOrgDomains`) — filter on vestigial `profiles.org_id/role` (frozen NULL post-Track-C) → match 0 rows; the "suspend all employees" incident kill switch silently does nothing. Fix: join through `memberships`.
- **M4** `src/lib/leave/seed.ts:48-89` (`applyDefaultBalancesForOrg`) — same vestigial-column query → leave-balance seeding silently seeds nobody. Fix: query `memberships`.
- **M5** `src/app/app/expenses/actions.ts:60-101`, `src/app/app/projects/actions.ts:41-80` — service-role reads with `orgId`/`employeeId` args and no `requireActiveProfile`/membership check; safe only because current callers pass server-derived ids, but they're in `"use server"` modules alongside client-wired actions. Fix: add the same auth check siblings use.
- **M6** `src/app/app/employees/invite-actions.ts:108-134` (`orgName`), `src/lib/documents/generate.tsx:242-250` (`employee.full_name`) — user-controlled text interpolated unescaped into outbound email HTML/subject. Fix: HTML-escape before interpolation.
- **M7** `src/components/documents/UserDocumentViewer.tsx` (DocxPreview) — `mammoth.convertToHtml()` output via `dangerouslySetInnerHTML` with no DOMPurify. Fix: sanitize before render.
- **M8** `src/contexts/TimerContext.tsx:76-90` — running-timer state is React-only (no persistence); refresh/crash loses the session. Fix: persist `{startedAt,project,description,billable}` and rehydrate.
- **M9** `src/lib/asana/connection.ts:147-189` (+ gmail/gcal equivalents) — token refresh has no locking; Asana rotates refresh tokens, so a concurrent refresh corrupts the connection. Fix: serialize per-connection (row lock / optimistic concurrency).
- **M10** `src/lib/webhook-dispatcher.ts:218-237` (`processWebhookRetries`) — no claim/lock before POST; overlapping cron runs double-deliver. Fix: atomic `UPDATE ... WHERE status='failed' RETURNING` / `processing` transition.
- **M11** `src/lib/reports/queries.ts:182-289`, `src/lib/time/pending-time-entries.ts:41-72`, `src/lib/time/trends.ts:196,256` — accept raw `orgId` without `trustOrgScope`, unlike the sibling dashboard/audit/leave queries. Fix: route through `trustOrgScope`/`trustRequiredOrgScope`.
- **M12** `src/components/gmail/InboxView.tsx:96-104` — `openThread` has no request-ordering guard (stale response can overwrite); auth-expiry paths throw unhandled. Fix: AbortController/request token + `.catch`.
- **M13** `src/app/app/expenses/actions.ts:124` (`submitExpense`) — `currency` coerced via `.toUpperCase().slice(0,3)` without the existing `validateCurrency()`. Fix: reuse `validateCurrency()`.
- **M14** `.github/workflows/ci.yml`, `.gitlab-ci.yml` — only typecheck/lint/build; no `npm audit`, no tests. Fix: add audit gate (and test step once tests exist).
- **M15** `scripts/qa-prod-api-webhook.mjs:170-172` — hardcoded real prod UUIDs; defaults to hitting production with the service-role key. Fix: move UUIDs to required env vars; require explicit prod opt-in.

## Detail — Low

- **L1** `src/app/api/cron/webhook-retries/route.ts:11` and the three OAuth callbacks — `!==` compare of `CRON_SECRET`/`state`. Fix: `crypto.timingSafeEqual`.
- **L2** All four `*-crypto.ts` — one shared `DOCUMENT_ENCRYPTION_KEY`, differentiated only by static salt; strength gate is `.length < 16` chars. Fix: per-domain keys or HKDF from a high-entropy root, real strength check.
- **L3** All four `*-crypto.ts` — `scryptSync` re-run per call on hot paths (per-request token decrypt, sync loops). Fix: memoize derived key per process.
- **L4** `src/lib/webhooks/actions.ts:31-38` — `http://` accepted. Fix: require `https:`.
- **L5** `src/app/api/documents/generate/route.ts:64-117` — no cap on `timesheet_ids`; one PDF+email per id. Fix: cap batch size, rate-limit.
- **L6** `src/app/app/time-tracked/actions.ts:170-186` (`notifyPendingTimeEntry`) — no auth; spoofable notifications. Fix: `requireActiveProfile` + membership check.
- **L7** `src/app/auth/signout/route.ts` — no CSRF/origin check → forced logout. Fix: check `Origin`/`Sec-Fetch-Site`.
- **L8** `20260701000001_f4_api_keys_webhook_endpoints.sql` — no index on `api_keys.user_id` / `webhook_endpoints.org_id`. Fix: add indexes.
- **L9** `package.json` — `three`/`@types/three` unused (Three.js dropped). Fix: `npm uninstall three @types/three`.
- **L10** `scripts/sync-from-cloud.sh`, `sync-to-cloud.sh` — destructive `reset --hard`/`clean -fd` and auto-commit-push with no guard. Fix: dirty-tree check + confirmation.
- **L11** `scripts/unstick-test-account.mjs:9` — defaults to a hardcoded personal email. Fix: require explicit arg.
- **L12** `src/app/app/employees/PlatformMembersAudit.tsx:34-40`, `expenses/actions.ts:60-101`, `InboxView.tsx:179-210` — unbounded queries / un-virtualized lists. Fix: paginate/window.
- **L13** `src/components/official-docs/OfficialDocSignModal.tsx:123-128` — signature canvas has no `aria-label`/typed fallback. Fix: add label + fallback.
- **L14** `src/lib/time/decimal-hours.ts:22-27` — 24h input wraps to `00:00`/`00:00`. Fix: cap at 23.99 or special-case.

---

## Phase 2 plan (fix order)

Highest severity and blast radius first. RLS regressions and the SSRF are the top priority because they are remotely exploitable by a normal tenant user/admin against live production data.

1. **D1, D2, D3** — RLS WITH CHECK regressions (one migration adding the missing status predicates; these are tightly related and land together as a security migration).
2. **I1** — webhook SSRF + stop reflecting response body.
3. **F1, F2** — stop exposing banking/tax PII to the client.
4. **A1, A2** — API-key revocation on suspend/remove; protect approved-timesheet deletion.
5. **D4** — make migrations apply cleanly from scratch.
6. **C1, C2, C3, C4** — correctness bugs (month nav, money math, timer 24h, doc idempotency), each with a regression test.
7. **N1, M2, M14** — dependency/CVE upgrade, security headers, CI hardening (larger; may be sequenced or flagged for owner sign-off given the Next major bump).
8. Remaining Medium/Low items as capacity allows.

Each fix is dispatched to a scoped subagent, its diff reviewed here, verified with `typecheck`/`lint`/`build` (and tests where added), then marked resolved in the table above.

---

## Phase 2 status (2026-07-08)

**Resolved: 34 of 43** — all 3 Critical, all 11 High (except N1, see below), 10 of 15 Medium, and 10 of 14 Low. Every change was reviewed against its diff and verified with `tsc --noEmit` + `next build` (correctness fixes C1/C2/C3 also have runnable checks; C1 ships a `node:test`). All fixes are committed and pushed to `claude/cadence-audit-fixes-cz2037`.

**Remaining (9) — needs a decision or larger effort, not yet done:**

| ID | Sev | Why it's still open |
|----|-----|---------------------|
| N1 | 🟠 High | Next.js 14→15 is a breaking major upgrade; needs runtime testing across all routes + owner sign-off. CI `npm audit` gate is in place (non-blocking) to track it. |
| M1 | 🟡 Medium | A cross-instance rate limiter needs a shared store (Upstash/Redis/Supabase) — an infra provisioning decision. |
| M7 | 🟡 Medium | Sanitizing `mammoth` docx HTML wants a vetted sanitizer (`isomorphic-dompurify`) — a new dependency; recommend adding it. |
| M8 | 🟡 Medium | Persisting/rehydrating running-timer state is a moderate client-state change worth designing (localStorage vs server record). |
| M9 | 🟡 Medium | Serializing OAuth token refresh needs a per-connection advisory lock or optimistic-concurrency column. |
| M10 | 🟡 Medium | Atomic webhook-retry claim needs a `claimed_at`/`processing` schema addition wired into the delivery-recording path to avoid double-counting attempts. |
| L2 | 🔵 Low | Per-domain key isolation / KMS is a key-management design decision. |
| L10 | 🔵 Low | Dirty-tree guards on the sync bash scripts (dev tooling only). |
| L12 | 🔵 Low | Pagination on platform-members/expenses/inbox lists — moderate, low urgency at current scale. |

Partial notes: **M2** shipped the safe header set; a full content-CSP (`script-src`/`style-src`) is deferred pending per-route testing. **M15** gated prod writes; moving the hardcoded UUIDs to env is a minor follow-up. **L5** capped the batch at 50; a rate limit is deferred. **L13** added the aria-label; a typed-name signature fallback is deferred.
