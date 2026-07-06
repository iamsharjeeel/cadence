# Cadence — Security Audit (read-only, findings only)

**Status:** INVENTORY ONLY (original audit). No code, RLS, or config was changed *by the audit*. Nothing here should be read as a blanket clearance.

> **Remediation update — 2026-06-14:** **C1, C2 and H1 are now FIXED** at the DB/storage-policy layer and each exploit was re-verified **closed against the live database** (project `irybkcryeywmwpcmhlaa`). **M1, M2, L1, L2 remain OPEN** (untouched). Migrations:
> - `supabase/migrations/20260625000000_c1_profiles_block_self_role_status_org_escalation.sql` (C1)
> - `supabase/migrations/20260626000000_c2_h1_drop_legacy_timesheets_storage_policies.sql` (C2/H1)
>
> Both were applied live via Supabase MCP `apply_migration`. See the per-finding ✅ blocks below for mechanism + verification evidence.

> **Track C — multi-workspace model change + isolation re-verification (2026-06-15):** the tenancy model was converted from single-org-per-user to **personal-by-default + many-to-many org memberships + a server-side active workspace** (branch `track-c-multiworkspace`, applied live to `irybkcryeywmwpcmhlaa`).
> - **C1** `20260627000000_track_c1_memberships_personal_scope.sql` — `memberships` table (read-own RLS, no client write path), `org_id` widened to NULLABLE on personal-capable tables, `create_organization()` RPC. Additive/non-destructive.
> - **C2** `20260628000000_track_c2_atomic_cutover_rls_rewrite.sql` — **`auth_org()` rewritten** to resolve the active workspace **validated against `memberships`** (a forged/stale active-workspace for a non-member org → NULL → no access); new `auth_workspace_role()` supplies the org role from `memberships` (the now-vestigial `profiles.role` is only used for the `superadmin` platform check). **Every tenant policy** re-keyed to `personal (org_id IS NULL, owner=auth.uid())` OR active-org OR superadmin-read. Atomic cutover: all 11 beta users → personal-only (`org_id` severed on owned rows; **87 links archived to `track_c_org_link_archive` for reversibility**; no row deleted). Superadmin preserved outside the workspace structure. The C1/C2/H1 fixes (profiles privileged-column guard trigger, scoped `timesheets` storage policies) are preserved.
> - **C4** `20260629000000_track_c4_invite_accept_rpcs.sql` — `accept_invite()` / `pending_invites_for_me()` RPCs; **domain auto-attach removed entirely** from onboarding. Membership-write paths are now exactly two — `create_organization` (owner of a new org) and `accept_invite` (an invite addressed to your own email) — so no user can self-grant into an arbitrary existing org.
> - **Isolation re-verification (tested as real `authenticated` via `SET ROLE` + injected `request.jwt.claims`, everything inside `ROLLBACK`):** the full a–h battery passed **44/44 in-rollback at C2** and **24/24 on the committed final branch state** (personal cannot reach any org; member reads/writes only their active org incl. storage; cross-org read/write denied for tables AND storage; escalation via `set_active_workspace` refused and a forged active-workspace row resolves to NULL; fresh 0-membership user reaches nothing; superadmin cross-tenant oversight intact; profiles guard holds; every migrated user still reads their own personal data; bogus `accept_invite` blocked).
> - **M1 and M2 are now CLOSED by C2** (the forgeable `audit_log` authenticated INSERT policy was dropped — audit writes are service-role only; `timesheet_rows` was re-scoped by its parent timesheet's owner). **L1/L2** remain as defense-in-depth notes.
> - **MERGED + DEPLOYED TO PRODUCTION (2026-06-15):** `track-c-multiworkspace` was fast-forwarded into `main` (production's prior commit `8dfa2f2` → **`d40fab4`**) and auto-promoted to production — live `<body data-build>` on `https://cadence-eta-five.vercel.app` = `d40fab4` (verified via authenticated fetch). **Post-deploy isolation re-verification on the LIVE production DB passed 30/30** as real `authenticated` sessions (a–e cross-tenant incl. storage; f superadmin oversight; g profiles guard; h cutover-integrity with no data loss; C4 bogus `accept_invite` blocked; and the **membership-write safety** — authenticated self-grant insert / own-role-change / delete-other / fresh self-grant all DENIED, since `memberships` has no client write path). Before the deploy, the old prod code's domain auto-attach had re-attached only the superadmin (1 profile + 1 timesheet) to Voxility; this drift was re-severed (now 0 org-attached profiles/timesheets, all 11 personal, superadmin `org_id` null). The new code removes the auto-attach mechanism so it cannot recur.
> - **Finalization follow-ups (2026-06-15):** employees role-change + remove rewritten to write `memberships` (membership-write safety re-verified above); `src/types/db.ts` regenerated (memberships/active_workspace/RPCs typed, all `as any` removed); leave-approval RPCs carry a dormant note to move to `auth_workspace_role()` when org leave is wired. Known infra limitation (out of scope, not fixed): preview deploys' Google OAuth redirects to the production URL (redirect-config), so the multi-workspace UI could only be exercised on production.

> **Re-verification update — 2026-07-06 (live via Supabase MCP):** Full live battery on project `irybkcryeywmwpcmhlaa` after MCP reconnected to correct org. Git `main` @ `9405ec9`.
> - **Live migrations:** 24 applied (MCP-managed names differ from repo phase files; functionally includes C1, C2/H1, Track C, F4 `api_keys`/`webhook_endpoints`, org settings, avatars, etc.). Repo has 23 consolidated files — **naming drift only**, not missing critical fixes.
> - **C1 ✅** — `guard_profiles_privileged_columns` trigger live; `authenticated` has no table-level `UPDATE` on `profiles`. Exploit: self `UPDATE role=superadmin` → **42501 permission denied**.
> - **C2/H1 ✅** — legacy `ts_read`/`ts_upload` **absent**; only `timesheets_storage_select` / `timesheets_storage_insert` remain.
> - **M1 ✅** — only `audit_log_select` policy; no INSERT for `authenticated`. Exploit: forge insert → **42501 RLS violation**.
> - **Track C ✅** — `set_active_workspace(non_member_org)` → **42501 not a member**; `memberships` INSERT → **42501 permission denied**; `active_workspace` direct write → **42501 permission denied**.
> - **F4 ✅** — RLS enabled on `api_keys`, `webhook_endpoints`. Policies: `api_keys_*_own` (user_id = auth.uid()); `webhook_endpoints_owner_admin` (memberships owner/admin). Cross-user `api_keys` INSERT → **42501 RLS**; non-manager `webhook_endpoints` INSERT → **42501 RLS**.
> - **W1 (fixed live 2026-07-06):** `webhook_deliveries.timesheet_id` was NOT NULL but `dispatchWebhookEvent` omits it for leave/member events — applied `webhook_deliveries_timesheet_id_nullable` migration live + repo backfill.
> - **L1/L2:** Still OPEN. Supabase advisor: 35 WARN lints (anon/authenticated EXECUTE on SECURITY DEFINER RPCs, org-logos public listing, mutable search_path on 2 functions) — defense-in-depth, not critical isolation breaks.
> - **Build health:** typecheck, lint, build — pass.

## Target confirmation (STEP 0)
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
| **C1** ✅ FIXED | 🔴 Critical | P2 / P4.2 | `profiles` policy `update own profile basics` + column grants | Any authenticated user can update their OWN `profiles` row's `role`, `org_id`, `status` (and `rate`) | Self-elevate to `superadmin` (→ all-orgs access via superadmin policies) or set `org_id` to any org (→ full cross-tenant access). Pure browser call, bypasses all app code. | `WITH CHECK (id = auth.uid())` only; `authenticated` has column-`UPDATE` on `role`,`org_id`,`status`; **no triggers** on `profiles` |
| **C2** ✅ FIXED | 🔴 Critical | P3.4 / P2 | `storage.objects` policy `ts_read` (bucket `timesheets`) | Any authenticated user can SELECT **every** object in the private `timesheets` bucket | A NULL-org or any-org user can list/download another org's raw payroll/timesheet files (`{org}/{emp}/{ts}/raw`). | `using (bucket_id='timesheets' AND auth.role()='authenticated')` — no org/path predicate; OR'd (permissive) with the scoped policy, so the loose one wins |
| **H1** ✅ FIXED | 🟠 High | P3.4 | `storage.objects` policy `ts_upload` (bucket `timesheets`) | Any authenticated user can INSERT objects at **any** path in `timesheets` | Write/overwrite into another org's folder (tamper, plant files). | `with check (bucket_id='timesheets' AND auth.role()='authenticated')` — no org/path predicate |
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

**✅ FIXED — 2026-06-14** — migration `20260625000000_c1_profiles_block_self_role_status_org_escalation.sql`, applied live via Supabase MCP `apply_migration`. Two independent layers:
1. **Column-privilege lockdown.** `authenticated`'s table-wide `UPDATE` on `public.profiles` (the Supabase default `GRANT ALL`, which made a column-only `REVOKE` ineffective) was dropped and re-granted as `UPDATE` on every column **except** `role`, `status`, `org_id`. `service_role` retains full table+column `UPDATE`, so the admin path (every `role`/`status`/`org_id` write goes through `createAdminClient` → service role: `onboarding.ts`, `invites.ts`, `employees/actions.ts`, `employees/assign-actions.ts`, `employees/remove-actions.ts`) is unaffected. Verified: `authenticated` table-level UPDATE = absent; `service_role` table-level UPDATE = present.
2. **SECURITY DEFINER trigger** `guard_profiles_privileged_columns` (`BEFORE UPDATE OF role, status, org_id`) rejects any change to those columns unless the session is the service-role API client (JWT `role='service_role'`) or a direct privileged DB session (no JWT context). EXECUTE revoked from `anon`/`authenticated` (a trigger fires regardless of grantee EXECUTE — re-verified).

**Live exploit re-test** (as the `authenticated` role with injected JWT claims for a non-privileged employee; every statement in `ROLLBACK`, committed `role/status/org_id` unchanged afterwards):
- self `UPDATE … SET role='superadmin'` → **BLOCKED** `42501 permission denied for table profiles`
- self `UPDATE … SET org_id='<org B>'` → **BLOCKED** `42501`
- self `UPDATE … SET status='suspended'` → **BLOCKED** `42501`
- self `UPDATE … SET full_name=…` (legit basic) → **SUCCESS** (self-edit feature preserved)
- role change with the column grant temporarily re-added (isolates layer 2) → **BLOCKED by the trigger** (`42501 profiles: role, status and org_id are administrator-managed and cannot be changed by this account`)
- `service_role` `UPDATE … SET role='owner'` (admin path) → **SUCCESS** (admin path intact)

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

**✅ FIXED — 2026-06-14** — migration `20260626000000_c2_h1_drop_legacy_timesheets_storage_policies.sql`, applied live via Supabase MCP. The legacy `ts_read` (SELECT) and `ts_upload` (INSERT) policies were **dropped**; only the org/path-scoped `timesheets_storage_select` / `timesheets_storage_insert` remain (verified: those two are now the only `timesheets` policies on `storage.objects`).

**Calibration correction:** production actually holds **2 orgs** (5 members each), not one. Org B (`d9385682-…`) owns all 5 timesheet files; Org A (`745dd1c9-…`) has none. So C2/H1 was a **live cross-tenant data exposure** (Org A users could read/overwrite Org B's real payroll files), not merely a latent gap.

**Live exploit re-test** (as a NON-privileged Org A employee, `authenticated` + JWT claims; every statement in `ROLLBACK`, bucket still 5 objects afterwards):
- READ (list/download) Org B's folder → **0 objects visible** (Org B's 5 files confirmed present in the postgres view) → cross-tenant read **denied** (C2 closed)
- READ own `{orgA}/{uid}/…` path → **1 object visible** → legit read **preserved**
- INSERT under own `{orgA}/{uid}/…` path → **SUCCESS** → legit upload **preserved**
- INSERT into Org B's `{orgB}/…` folder → **BLOCKED** `42501 new row violates row-level security policy for table "objects"` (H1 closed)

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
1. ✅ **DONE (2026-06-14)** **C1** — prevent `authenticated` self-update of `profiles.role`/`org_id`/`status` (column-scoped grant and/or value-pinning guard for non-admins). *Fixed via column-grant reset + SECURITY DEFINER trigger; exploit re-verified blocked live.*
2. ✅ **DONE (2026-06-14)** **C2/H1** — drop legacy `ts_read`/`ts_upload` storage policies so only the org/path-scoped `timesheets_storage_*` remain. *Dropped; cross-tenant read/write re-verified blocked live.*
3. ✅ **DONE (2026-06-15, Track C2)** **M1** — dropped the `authenticated` INSERT policy on `audit_log` (writes are service-role only).
4. ✅ **DONE (2026-06-15, Track C2)** **M2** — `timesheet_rows` policies re-scoped by the parent timesheet's owner (personal: parent owned by you; org: parent in your active org).
5. **L1** — narrow `anon` table grants (defense-in-depth).
6. **L2** — have service-role lib aggregators re-assert org scope rather than trust caller `orgId` (defense-in-depth).
