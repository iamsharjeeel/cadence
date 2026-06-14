# Cadence — Security Audit (read-only, findings only)

**Status:** INVENTORY ONLY. No code, RLS, or config was changed. Fixes are pending separate triage. Nothing here should be read as a clearance.

## Target confirmation (STEP 0)
- **Supabase project ref:** `irybkcryeywmwpcmhlaa` (name `cadence`, status `ACTIVE_HEALTHY`). ✅ matches.
  - Note: live region reports `ap-southeast-2` (Sydney); the handover labelled it "Singapore". The **ref** is the authoritative match, so the audit proceeded. Region label is a doc nuance, not a target mismatch.
- **Git:** `main` @ `acef7f3` (`acef7f30f5745487cc04b9acfb1bcc4bad18bb8f`). ✅ matches.
- **Method:** Live DB policies/grants/triggers read directly via Supabase MCP `execute_sql` (migration files NOT trusted). Code read on `main@acef7f3`.

---

## Headline verdict — does multi-tenant isolation hold?

**No — two critical gaps break it, both at the database/storage policy layer (not app code).**

- **(a) `org_id = NULL` fresh signups:** For every `public` tenant table, isolation HOLDS via `org_id = auth_org()` (a NULL org never matches any row). **EXCEPT** they can (C1) self-update their own `profiles` row to set `org_id`/`role`/`status`, and (C2) read/write the `timesheets` storage bucket. So a brand-new Google signup can self-promote to `superadmin` or read payroll files.
- **(b) cross-org (org A → org B):** Table reads/writes are correctly pinned to `org_id = auth_org()` on both read and write for the standard path. **BUT** (C1) lets any user re-point their own `org_id` to org B (then inherit full org-B access through the normal policies), and (C2) lets any authenticated user read/write org B's timesheet files directly.

**Calibration:** Production currently holds data for a **single org** (1 distinct org folder per storage bucket; see evidence). So "org A reads org B" has no second tenant to exploit *today*, but C1 (self-elevation) and the NULL-org → `timesheets` bucket read are exploitable **now** by any signup, and both controls will leak the moment a second org exists.

---

## Severity-ranked findings

| ID | Severity | Priority | Location | Finding | Why it matters | Evidence |
|----|----------|----------|----------|---------|----------------|----------|
| **C1** | 🔴 Critical | P2 / P4.2 | `profiles` policy `update own profile basics` + column grants | Any authenticated user can update their OWN `profiles` row's `role`, `org_id`, `status` (and `rate`) | Self-elevate to `superadmin` (→ all-orgs access via superadmin policies) or set `org_id` to any org (→ full cross-tenant access). Pure browser call, bypasses all app code. | `WITH CHECK (id = auth.uid())` only; `authenticated` has column-`UPDATE` on `role`,`org_id`,`status`; **no triggers** on `profiles` |
| **C2** | 🔴 Critical | P3.4 / P2 | `storage.objects` policy `ts_read` (bucket `timesheets`) | Any authenticated user can SELECT **every** object in the private `timesheets` bucket | A NULL-org or any-org user can list/download another org's raw payroll/timesheet files (`{org}/{emp}/{ts}/raw`). | `using (bucket_id='timesheets' AND auth.role()='authenticated')` — no org/path predicate; OR'd (permissive) with the scoped policy, so the loose one wins |
| **H1** | 🟠 High | P3.4 | `storage.objects` policy `ts_upload` (bucket `timesheets`) | Any authenticated user can INSERT objects at **any** path in `timesheets` | Write/overwrite into another org's folder (tamper, plant files). | `with check (bucket_id='timesheets' AND auth.role()='authenticated')` — no org/path predicate |
| **M1** | 🟡 Medium | P3.3 | `audit_log` policy `authenticated insert audit` | Any authenticated user can INSERT arbitrary `audit_log` rows for any `org_id`/`actor_id` | Forge/spoof audit entries (attribute actions to others, inject content admins read), cross-org write. App writes audit via service-role, so this policy is unused attack surface. | `with check (auth.uid() IS NOT NULL)` — no org/actor binding |
| **M2** | 🟡 Medium | P3.2 / P3.3 | `timesheet_rows` policies `rows_select`, `rows_update` | Any org member can read AND update **all** legacy `timesheet_rows` in their org (no employee/ownership predicate) | Intra-org (not cross-tenant): an employee reads/edits colleagues' legacy uploaded hours/projects. Legacy table. | `rows_select using (org_id = auth_org())`; `rows_update using (org_id = auth_org())` — org-only, no `employee_id`/owner check |
| **L1** | 🔵 Low | P2.4 | `anon` table grants | `anon` role holds INSERT/UPDATE/DELETE on `profiles` (and other tables) | Currently neutralized by RLS (`auth.uid()` is NULL for anon, so no policy matches), but over-broad grants are a defense-in-depth smell / one-policy-away from exposure. | `role_table_grants`: anon has INSERT/UPDATE/DELETE on `profiles`; column-UPDATE on `role`,`org_id`,`status` |
| **L2** | 🔵 Low | P1.x | `dashboard/queries.ts`, `trends.ts`, `audit/queries.ts`, `leave/queries.ts` | Service-role lib functions trust a caller-supplied `orgId` param (no independent re-derivation) | Safe *today* because all current callers force `profile.org_id` (non-superadmin) or gate superadmin; but a future caller passing client `orgId` without gating would leak. Latent. | functions accept `orgId`/`org_id` arg + `createAdminClient()` |
| **I1** | ⚪ Info | P2.1 | all `public` tables | `relforcerowsecurity = false` everywhere | Normal: `service_role` bypasses RLS via role `BYPASSRLS`, not via FORCE; app never queries as table owner. Not a gap. | `pg_class.relforcerowsecurity=false` |
| **I2** | ⚪ Info | P3 | most RLS policies | The `owner` role is absent from nearly all policies (only `org_invites`) | Owners get elevated org reads via server-side `createAdminClient` + app role checks, not RLS; RLS treats `owner` like an employee. Privilege correctness depends on the app layer. | policies reference `admin`/`superadmin`, not `owner` |
| **I3** | ⚪ Info | P2 | `audit_log` (×3 SELECT), `webhook_deliveries` (×2 SELECT), `documents` bucket | Redundant/overlapping policies | Cleanliness only; all overlapping policies are correctly org/role scoped. | duplicate policy rows in `pg_policies` |

---

## Detailed critical/high findings

### C1 — `profiles` self-elevation (cross-tenant + privilege escalation) 🔴
**Live policy (verbatim):**
```
"update own profile basics"  UPDATE  {public}
  USING      (id = auth.uid())
  WITH CHECK (id = auth.uid())
```
**Live grants:** `authenticated` has `UPDATE` on every `profiles` column, including `role`, `org_id`, `status`, `rate`, `onboarding_complete` (verified via `information_schema.column_privileges`).
**Triggers:** none on `public.profiles` (verified via `pg_trigger`).

Postgres RLS cannot restrict *which columns* an UPDATE touches; the only guard here is `id = auth.uid()`, which a user trivially satisfies on their own row. With the public anon key + their own session JWT (role `authenticated`), a user runs from the browser:
```
supabase.from('profiles').update({ role: 'superadmin' }).eq('id', <their uid>)   // → platform takeover
supabase.from('profiles').update({ org_id: '<org B uuid>' }).eq('id', <their uid>) // → cross-tenant
```
Both commit. Afterwards `auth_role()`/`auth_org()` (SECURITY DEFINER, read from `profiles`) return the attacker-chosen values, so every downstream policy now grants the escalated access. App-layer field whitelisting in the profile server actions is irrelevant — the attacker never calls app code.
**Direction (not a fix):** the write path needs to forbid `authenticated` from changing `role`/`org_id`/`status` on self — e.g. column-scoped UPDATE grant and/or a guard that pins those columns to their prior values for non-admins.

### C2 / H1 — `timesheets` storage bucket world-readable/writable to any authenticated user 🔴/🟠
**Live policies (verbatim):**
```
ts_read    SELECT {public}  using ((bucket_id='timesheets') AND (auth.role()='authenticated'))
ts_upload  INSERT {public}  with check ((bucket_id='timesheets') AND (auth.role()='authenticated'))
-- coexisting, correctly-scoped (but OR'd, so ineffective as a guard):
timesheets_storage_select USING ((bucket_id='timesheets') AND (superadmin OR (foldername[1]=auth_org() AND (admin OR foldername[2]=auth.uid()))))
timesheets_storage_insert WITH CHECK ((bucket_id='timesheets') AND is_active() AND foldername[1]=auth_org() AND foldername[2]=auth.uid())
```
RLS policies are **permissive (OR'd)** — confirmed `permissive=PERMISSIVE` for all `storage.objects` policies. So the loose `ts_read`/`ts_upload` grant access regardless of the scoped policies. Any authenticated user (including a fresh `org_id=NULL` signup) can `storage.from('timesheets').list()/download()` across all orgs, and upload to any path. Bucket currently holds **5 objects** under **1** org folder. This is the classic "migration diverged from live": the security migration ADDED the scoped policies but the legacy `ts_read`/`ts_upload` were never dropped.
**Direction (not a fix):** drop the legacy `ts_read`/`ts_upload` policies so only the org/path-scoped policies remain. (Other buckets — `documents`, `official-documents`, `org-logos` — are already correctly path-scoped.)

### M1 — `audit_log` forgeable inserts 🟡
`authenticated insert audit` `WITH CHECK (auth.uid() IS NOT NULL)` lets any authenticated user insert audit rows with arbitrary `org_id`, `actor_id`, `action`, `payload`. The application writes all real audit entries via `createAdminClient()` (`src/lib/audit.ts:49`), so this policy serves no app purpose and is pure forgery surface. **Direction:** remove the authenticated INSERT policy (audit writes are service-role only).

### M2 — `timesheet_rows` intra-org over-exposure 🟡
`rows_select`/`rows_update` are scoped to `org_id = auth_org()` only — no `employee_id`/timesheet-ownership predicate — so any org member can read or modify colleagues' legacy timesheet rows. Not cross-tenant (org pinned), but breaks intra-org employee isolation for the legacy upload table. **Direction:** add an employee/ownership predicate (or accept as legacy-admin-only).

---

## Priority 1 — `createAdminClient()` (RLS-bypass) call-site inventory

RLS-bypassing call sites enumerated via `rg -n "createAdminClient" src`. **Every site classifies (a) SAFE or (b) SAFE-SUPERADMIN. None take a client-supplied `org_id` as the scope key (no (c)); none touch a tenant table with no scoping (no (d)).** The tenant key is always derived server-side from the session (`profile.id`/`profile.org_id` via `requireActiveProfile`/`requireRole`/`getProfile`) or from a looked-up record's own `org_id`, and superadmin-only paths are gated by `auth_role()`/server `profile.role` (never client-supplied role).

| File(s) | Tables | Scope key source | Class |
|---------|--------|------------------|-------|
| `lib/supabase/admin.ts` | — | factory; `import "server-only"` guard | n/a |
| `lib/audit.ts` (writeAudit) | audit_log | actorId/orgId from calling server action (session/record) | (a) |
| `lib/invites.ts` (redeemOrgInvite) | org_invites, profiles | invite matched by OAuth-verified email at onboarding | (a) |
| `lib/onboarding.ts` (runOnboarding) | profiles, organizations, org_invites | `userId`/`email` from OAuth session; superadmin backstop pending-only | (a) |
| `lib/documents/authorization.ts` | timesheets | org derived from record, validated vs `actor.org_id` | (a) |
| `lib/documents/generate.tsx` | documents, timesheets, profiles, storage | actor + pre-authorized timesheet; org from record | (a) |
| `lib/documents/queries.ts` (getApprovedTimesheetsWithoutDocuments) | timesheets | admin forced `eq org_id profile.org_id`; superadmin platform | (a)/(b) |
| `lib/asana/connection.ts` | asana_connections | `profile.id` (session) | (a) |
| `lib/google-calendar/connection.ts`, `sync.ts` | gcal_* | `profile.id` (session) | (a) |
| `lib/time/get-time-tracking-data.ts` | timesheets, time_entries, projects | `profile.id` (session) | (a) |
| `lib/time/week-stats.ts` | time_entries | `timesheetId` (record) | (a) |
| `lib/time/trends.ts` | time_entries, profiles, orgs | `orgId` from caller (forces own org for non-superadmin) | (a)/(b) |
| `lib/dashboard/queries.ts` | timesheets, time_entries, profiles | `orgId` from caller (dashboard gates) | (a)/(b) |
| `lib/audit/queries.ts` | audit_log, profiles | `orgId` from caller (audit page forces own org) | (a)/(b) |
| `lib/leave/queries.ts`, `lib/leave/seed.ts` | leave_* | session profile/org; seed at org-create (superadmin) | (a)/(b) |
| `lib/onboarding/progress.ts` | onboarding_steps | session profile.id | (a) |
| `lib/notifications.ts` | notifications | userId/orgId from triggering server action | (a) |
| `api/timesheets/export/route.ts` | timesheets, profiles, rows | getProfile + role; admin forced own org | (a)/(b) |
| `api/audit/export/route.ts` | audit_log, profiles | getProfile + role; admin forced own org | (a)/(b) |
| `app/documents/page.tsx`, `documents/actions.ts` | documents | role-gated; admin own org / record-derived | (a)/(b) |
| `app/dashboard/page.tsx` | organizations | superadmin-gated; `?org` → slug redirect (validated) | (b) |
| `app/orgs/[slug]/dashboard/page.tsx` | organizations | slug→org validated vs `actor.org_id` for admin | (a)/(b) |
| `app/audit/page.tsx`, `trends/page.tsx` | organizations | superadmin-only org list | (b) |
| `app/timesheets/page.tsx` | timesheets, time_entries, profiles, orgs | non-superadmin uses RLS client + own org; superadmin gated | (a)/(b) |
| `app/timesheets/[id]/page.tsx`, `timesheets/actions.ts` | timesheets, time_entries | role + ownership/org checks; record-derived | (a) |
| `app/leave/page.tsx`, `leave/actions.ts` | leave_* | session profile/org; approve/reject via SECURITY DEFINER RPC re-checking role+org | (a) |
| `app/onboarding/page.tsx`, `onboarding/actions.ts` | profiles, onboarding_steps | session profile.id | (a) |
| `app/organizations/actions.ts` | organizations | `requireRole(["superadmin"])` | (b) |
| `app/employees/assign-actions.ts` (assignMemberToOrg) | profiles, organizations | `requireRole(["superadmin"])`; target must be org-less | (b) |
| `app/profile/asana-actions.ts` | asana_connections, notifications | `profile.id` (session) | (a) |

**1.3 named suspects — explicit answers (do they trust a client `org_id`?):**
- `getEmployeeDashboard`/`getAdminDashboard`/`getSuperadminOrgSummaries`: **No.** Employee = own `profile.id`; admin = own `profile.org_id`; superadmin summaries are platform-wide and only reached in the `role==='superadmin'` branch.
- `/api/documents/generate` + `generate.tsx`: **No.** Client sends `timesheet_id`(s); org is read from the timesheet record and validated by `authorizeTimesheetForDocument` (employee-own / admin-same-org / superadmin).
- `uploadOrgLogo` (settings): writes to `org-logos` via service role on `profile.org_id` path; storage RLS additionally pins `foldername[1]=auth_org()`. **No client org_id.** (Not individually re-opened this pass; logo path derives from session org.)
- `SettingsContent` superadmin path: superadmin uses the `?org` param **only** when `role==='superadmin'` (server-derived); admin uses own org. **No.**
- `upsertAsanaConnection` / GCal connection writes: keyed on `profile.id` (session). **No.**
- `getApprovedTimesheetsWithoutDocuments`: admin forced to `profile.org_id`; superadmin optional. **No.**
- `assignMemberToOrg`/`removeMemberFromOrg`: `requireRole` superadmin/owner-admin; superadmin may legitimately target any org. **No untrusted org_id.**
- unstick scripts (`supabase/scripts/*`, `scripts/unstick-test-account.mjs`): operator-run with service role; not reachable from the app. Out of request path.

**1.4 — `SUPABASE_SERVICE_ROLE_KEY` server-only:** ✅ referenced only in `src/lib/supabase/admin.ts`, which begins with `import "server-only"` (build fails if bundled client-side), uses `persistSession:false`, and is not `NEXT_PUBLIC`. No client/`NEXT_PUBLIC` reference anywhere.

---

## Priority 3 — cross-tenant matrix (live policies)

`auth_org()` / `auth_role()` / `is_active()` are `STABLE SECURITY DEFINER` functions selecting from `profiles WHERE id = auth.uid()` — values are server-derived and cannot be spoofed by the client. For a `NULL`-org user, `auth_org()` is NULL and `org_id = NULL` is never true, so org-scoped rows are invisible/unwritable.

| Table | NULL-org read/write | org A → read org B | org A → write org B |
|-------|---------------------|--------------------|---------------------|
| organizations | ✔ blocked (`id=auth_org()`) | ✔ blocked | ✔ blocked (superadmin-only writes) |
| profiles | ✔ own row only | ✔ blocked (own/admin-org/superadmin) | 🔴 **C1** (self-update role/org_id/status) |
| timesheets | ✔ blocked | ✔ blocked (`org_id=auth_org()`) | ✔ blocked (WITH CHECK `org_id=auth_org()`) |
| timesheet_rows | ✔ blocked | ✔ cross-org blocked; 🟡 **M2** intra-org over-read | ✔ cross-org blocked; 🟡 **M2** intra-org over-write |
| time_entries | ✔ blocked | ✔ blocked | ✔ blocked (INSERT WITH CHECK + UPDATE USING pins `org_id`) |
| projects | ✔ blocked | ✔ blocked | ✔ blocked (WITH CHECK `org_id=auth_org()`) |
| documents | ✔ blocked | ✔ blocked | ✔ blocked (admin-only insert, org-pinned) |
| official_documents | ✔ blocked | ✔ blocked | ✔ blocked |
| leave_types/balances/requests | ✔ blocked | ✔ blocked | ✔ blocked (org-pinned; approve/reject RPC re-checks) |
| notifications | ✔ own (`user_id=auth.uid()`) | ✔ blocked | ✔ blocked (no INSERT policy; service-role only) |
| audit_log | ✔ read blocked | ✔ read blocked (admin/superadmin org) | 🟡 **M1** (forge inserts for any org) |
| webhook_deliveries | ✔ blocked | ✔ blocked | ✔ blocked (no write policy) |
| org_invites | ✔ blocked | ✔ blocked | ✔ blocked (admin/owner own-org + invited_by) |
| asana_connections / imported | ✔ own (`user_id`) | ✔ blocked | ✔ blocked (own user only; tokens never cross-user) |
| google_calendar_connections / events / selected_calendars | ✔ own (`user_id`) | ✔ blocked | ✔ blocked (own user only) |

**3.4 Storage:** `documents`, `official-documents` → org-scoped by `foldername[1]=auth_org()`, employees limited to `foldername[2]=auth.uid()`, superadmin all; INSERT admin/superadmin only. `org-logos` → public read (intended), writes admin/superadmin own-org. `timesheets` → 🔴 **C2/H1** (loose legacy policies). `signature_data` and encrypted bank fields are never selected into list queries (bank reaches client only via `maskSensitive` last-4; signatures fetched per-document server-side). ✅

---

## Priority 4 — auth-config edges

- **4.1 SUPERADMIN_EMAIL backstop** (`src/lib/onboarding.ts`): only promotes when `profile.status === 'pending'` AND the email equals `SUPERADMIN_EMAIL`, with `.eq("status","pending")` on the UPDATE — **promote-only, never demotes an active user**. Email is `user.email` from the OAuth session (`src/app/auth/callback/route.ts:34`), i.e. Google-verified, not client-supplied. A user cannot self-elevate by "claiming" the email without controlling that Google account. ✅ (Self-elevation risk is C1, not this path.)
- **4.2 Self-elevation via profile update:** app server actions whitelist fields, **but the RLS layer does not** — see **C1**. This is the dominant finding.
- **4.3 Encrypted-secret exposure:** `bank-crypto.ts`, `asana-crypto.ts`, `google-calendar/crypto.ts` all start with `import "server-only"`. Decrypted Asana/GCal tokens are used only to call/revoke external APIs server-side; never returned in an action result, API response, or log. Bank fields reach the client only via `maskSensitive` (last-4). `DOCUMENT_ENCRYPTION_KEY` is server-only (never `NEXT_PUBLIC`). ✅
- **4.4 API-route auth:** `/api/timesheets/export`, `/api/audit/export`, `/api/documents/generate`, `/api/asana/*`, `/api/google-calendar/*` each call `getProfile()` and re-check `status==='active'` + role server-side; exports force admin→own-org and gate superadmin; document generation re-authorizes per timesheet record. ✅
- **4.5 `NEXT_PUBLIC_` surface:** only `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_COMMIT_SHA`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — all intended/public (anon key is public by design). Nothing sensitive exposed. ✅

---

## What's solid (calibration)
- RLS is **enabled on all 21 `public` tables**.
- `auth_org()`/`auth_role()`/`is_active()` are SECURITY DEFINER reading from `profiles` by `auth.uid()` — **unspoofable**; clients cannot inject org/role.
- Standard tenant tables pin reads to `org_id = auth_org()` and writes via INSERT `WITH CHECK org_id = auth_org()` / UPDATE `USING`-as-check — **no cross-tenant table read or write** on the normal path; NULL-org users see nothing.
- Per-user token tables (`asana_connections`, `google_*`) restricted to `user_id = auth.uid()`; `asana_connections` has no INSERT/UPDATE policy (server-role writes only) — **no user can read another's encrypted tokens**.
- **Every** `createAdminClient()` (RLS-bypass) call site derives the tenant key server-side and never trusts a client `org_id`; superadmin paths gate on server-derived role.
- Service-role key + encryption key are strictly server-only; decrypted secrets never cross to the client; bank fields masked.
- API routes and server actions re-check auth + role server-side; document generation/exports are org-scoped; leave approval goes through SECURITY DEFINER RPCs that re-verify reviewer role + org.
- `documents`/`official-documents`/`org-logos` storage buckets are correctly path/org scoped.

---

## Triage queue (one-line direction only — NOT applied)
1. **C1** — prevent `authenticated` self-update of `profiles.role`/`org_id`/`status` (column-scoped grant and/or value-pinning guard for non-admins).
2. **C2/H1** — drop legacy `ts_read`/`ts_upload` storage policies so only the org/path-scoped `timesheets_storage_*` remain.
3. **M1** — remove the `authenticated` INSERT policy on `audit_log` (writes are service-role only).
4. **M2** — add an employee/ownership predicate to `timesheet_rows` `rows_select`/`rows_update`.
5. **L1** — narrow `anon` table grants (defense-in-depth).
6. **L2** — have service-role lib aggregators re-assert org scope rather than trust caller `orgId` (defense-in-depth).
