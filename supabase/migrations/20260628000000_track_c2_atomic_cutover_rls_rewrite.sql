-- =====================================================================
-- Track C2 — Atomic cutover + RLS rewrite for true multi-workspace
-- =====================================================================
-- Converts the live model from single-org-per-user to personal-by-default
-- + many-to-many org memberships, and rewrites every tenant RLS policy to
-- key off the VALIDATED active workspace. Applied live to project
-- irybkcryeywmwpcmhlaa via Supabase MCP (shared prod+preview DB).
--
-- Mechanism:
--   * active_workspace(user_id -> org_id): server-side per-user context.
--   * auth_org() REWRITTEN: returns the active workspace's org ONLY IF the
--     user holds a membership in it (join memberships); else NULL (personal).
--     A forged/stale active-workspace row for a non-member org -> NULL.
--   * auth_workspace_role(): the caller's role IN the active org (owner/
--     admin/employee) or NULL. Org-context admin checks use THIS, not the
--     now-vestigial profiles.role. auth_role()='superadmin' stays the
--     platform-oversight check. auth_role()/is_active() are NOT redefined.
--   * set_active_workspace(org): switch context; refuses a non-member org.
--
-- Cutover (one-time, guarded by "memberships + active_workspace empty"):
--   every existing user becomes personal-only. Their owned rows have org_id
--   set to NULL (personal scope = org_id IS NULL, owned via employee_id/
--   user_id/owner_id). DATA IS NOT DELETED — only the org link is severed,
--   and every severed link is recorded in track_c_org_link_archive first.
--   Old orgs (Voxility/Google) are left inert/unreferenced. Superadmin
--   (sharjeel@voxility.ai) keeps role='superadmin' and is moved out of any
--   workspace (org_id NULL) — platform oversight, not a workspace member.
--   memberships stays 0 rows (nobody is in an org until C3/C4).
--
-- Preserves the C1/C2/H1 security fixes: profiles privileged-column guard
-- trigger + column grants + "update own profile basics"/"read own profile"/
-- "superadmin full profile access" policies, and the org/path-scoped
-- timesheets/documents/official-documents/org-logos storage policies — all
-- UNTOUCHED. Per-user token tables (asana_*, google_*) + notifications
-- (user_id-scoped) UNTOUCHED. Idempotent.
-- =====================================================================

-- 1. active_workspace --------------------------------------------------
create table if not exists public.active_workspace (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  org_id  uuid not null references public.organizations(id) on delete cascade,
  set_at  timestamptz not null default now()
);
alter table public.active_workspace enable row level security;
revoke all on public.active_workspace from anon;
revoke all on public.active_workspace from authenticated;
grant select on public.active_workspace to authenticated;
drop policy if exists active_workspace_select_own on public.active_workspace;
create policy active_workspace_select_own on public.active_workspace
  for select to authenticated using (user_id = auth.uid());

-- 2. org-link archive (forensic + rollback aid; superadmin read only) --
create table if not exists public.track_c_org_link_archive (
  id              bigint generated always as identity primary key,
  table_name      text not null,
  row_id          uuid not null,
  original_org_id uuid not null,
  archived_at     timestamptz not null default now()
);
alter table public.track_c_org_link_archive enable row level security;
revoke all on public.track_c_org_link_archive from anon;
revoke all on public.track_c_org_link_archive from authenticated;
grant select on public.track_c_org_link_archive to authenticated;
drop policy if exists track_c_archive_superadmin_read on public.track_c_org_link_archive;
create policy track_c_archive_superadmin_read on public.track_c_org_link_archive
  for select to authenticated using (public.auth_role() = 'superadmin');

-- 3. helper functions --------------------------------------------------
-- auth_org(): VALIDATED active workspace org (NULL = personal context)
create or replace function public.auth_org()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select aw.org_id
  from public.active_workspace aw
  join public.memberships m on m.user_id = aw.user_id and m.org_id = aw.org_id
  where aw.user_id = auth.uid();
$$;

-- auth_workspace_role(): caller's role in the active org (NULL if personal)
create or replace function public.auth_workspace_role()
returns public.user_role language sql stable security definer set search_path to 'public' as $$
  select m.role
  from public.active_workspace aw
  join public.memberships m on m.user_id = aw.user_id and m.org_id = aw.org_id
  where aw.user_id = auth.uid();
$$;

-- my_org_ids(): every org the caller is a member of (RLS-bypassing helper)
create or replace function public.my_org_ids()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

-- active_org_member_ids(): all member user_ids of the caller's active org
create or replace function public.active_org_member_ids()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select m.user_id from public.memberships m where m.org_id = public.auth_org();
$$;

-- set_active_workspace(): switch context; NULL = personal; refuses non-member org
create or replace function public.set_active_workspace(p_org_id uuid)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if p_org_id is null then
    delete from public.active_workspace where user_id = v_uid;
    return;
  end if;
  if not exists (select 1 from public.memberships where user_id = v_uid and org_id = p_org_id) then
    raise exception 'not a member of this organization' using errcode='42501';
  end if;
  insert into public.active_workspace (user_id, org_id) values (v_uid, p_org_id)
  on conflict (user_id) do update set org_id = excluded.org_id, set_at = now();
end; $$;
revoke all on function public.set_active_workspace(uuid) from public, anon;
grant execute on function public.set_active_workspace(uuid) to authenticated;

-- 4. personal leave types need an owner column -------------------------
alter table public.leave_types add column if not exists user_id uuid references public.profiles(id) on delete cascade;
create index if not exists leave_types_user_id_idx on public.leave_types(user_id);

-- 5. ATOMIC CUTOVER (guarded: only when no memberships/active_workspace) -
do $cutover$
begin
  if (select count(*) from public.memberships) = 0
     and (select count(*) from public.active_workspace) = 0 then

    insert into public.track_c_org_link_archive (table_name, row_id, original_org_id)
      select 'profiles', id, org_id from public.profiles where org_id is not null
      union all select 'time_entries', id, org_id from public.time_entries where org_id is not null
      union all select 'timesheets', id, org_id from public.timesheets where org_id is not null
      union all select 'timesheet_rows', id, org_id from public.timesheet_rows where org_id is not null
      union all select 'documents', id, org_id from public.documents where org_id is not null
      union all select 'official_documents', id, org_id from public.official_documents where org_id is not null and employee_id is not null
      union all select 'onboarding_steps', id, org_id from public.onboarding_steps where org_id is not null
      union all select 'notifications', id, org_id from public.notifications where org_id is not null
      union all select 'projects', id, org_id from public.projects where org_id is not null and owner_id is not null
      union all select 'leave_balances', id, org_id from public.leave_balances where org_id is not null
      union all select 'leave_requests', id, org_id from public.leave_requests where org_id is not null;

    update public.profiles           set org_id = null where org_id is not null;
    update public.time_entries       set org_id = null where org_id is not null;
    update public.timesheets         set org_id = null where org_id is not null;
    update public.timesheet_rows     set org_id = null where org_id is not null;
    update public.documents          set org_id = null where org_id is not null;
    update public.official_documents set org_id = null where org_id is not null and employee_id is not null;
    update public.onboarding_steps   set org_id = null where org_id is not null;
    update public.notifications      set org_id = null where org_id is not null;
    update public.projects           set org_id = null where org_id is not null and owner_id is not null;
    update public.leave_balances     set org_id = null where org_id is not null;
    update public.leave_requests     set org_id = null where org_id is not null;
    -- leave_types (org templates, no owner), audit_log, webhook_deliveries,
    -- org_invites, and org-wide projects (owner_id NULL) are left attached to
    -- the now-inert orgs (not personal data).
  end if;
end $cutover$;

-- 6. TENANT POLICY REWRITE --------------------------------------------
-- Pattern: personal (org_id IS NULL AND owner=auth.uid())
--   OR org (org_id = auth_org(), with active-org role rules)
--   OR superadmin (SELECT only — oversight). Writes never grant superadmin
--   (privileged writes go through the service role).

-- time_entries (owner: employee_id)
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries for select to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
  or auth_role() = 'superadmin'
);
drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries for insert to authenticated with check (
  is_active() and employee_id = auth.uid() and (org_id is null or org_id = auth_org())
);
drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (employee_id = auth.uid() or auth_workspace_role() = any(array['owner','admin']::user_role[])))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (employee_id = auth.uid() or auth_workspace_role() = any(array['owner','admin']::user_role[])))
);
drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries for delete to authenticated using (
  ((org_id is null and employee_id = auth.uid()) or (org_id = auth_org() and employee_id = auth.uid()))
  and (timesheet_id is null or exists (select 1 from public.timesheets t where t.id = time_entries.timesheet_id and t.status = any(array['draft','rejected'])))
);

-- timesheets (owner: employee_id)
drop policy if exists timesheets_select on public.timesheets;
create policy timesheets_select on public.timesheets for select to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
  or auth_role() = 'superadmin'
);
drop policy if exists timesheets_insert on public.timesheets;
create policy timesheets_insert on public.timesheets for insert to authenticated with check (
  is_active() and employee_id = auth.uid() and (org_id is null or org_id = auth_org())
);
drop policy if exists timesheets_update on public.timesheets;
create policy timesheets_update on public.timesheets for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = any(array['draft','rejected']))))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
);

-- timesheet_rows (legacy; owner via parent timesheet) — also closes M2
drop policy if exists rows_select on public.timesheet_rows;
drop policy if exists rows_insert on public.timesheet_rows;
drop policy if exists rows_update on public.timesheet_rows;
drop policy if exists rows_delete on public.timesheet_rows;
create policy timesheet_rows_select on public.timesheet_rows for select to authenticated using (
  exists (select 1 from public.timesheets t where t.id = timesheet_rows.timesheet_id and (
    (t.org_id is null and t.employee_id = auth.uid())
    or (t.org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or t.employee_id = auth.uid()))))
  or auth_role() = 'superadmin'
);
create policy timesheet_rows_insert on public.timesheet_rows for insert to authenticated with check (
  is_active() and exists (select 1 from public.timesheets t where t.id = timesheet_rows.timesheet_id and t.employee_id = auth.uid() and (t.org_id is null or t.org_id = auth_org()))
);
create policy timesheet_rows_update on public.timesheet_rows for update to authenticated using (
  exists (select 1 from public.timesheets t where t.id = timesheet_rows.timesheet_id and ((t.org_id is null and t.employee_id = auth.uid()) or (t.org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or t.employee_id = auth.uid()))))
) with check (
  exists (select 1 from public.timesheets t where t.id = timesheet_rows.timesheet_id and ((t.org_id is null and t.employee_id = auth.uid()) or (t.org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or t.employee_id = auth.uid()))))
);
create policy timesheet_rows_delete on public.timesheet_rows for delete to authenticated using (
  exists (select 1 from public.timesheets t where t.id = timesheet_rows.timesheet_id and t.employee_id = auth.uid() and t.status = any(array['draft','rejected']))
);

-- projects (owner: owner_id)
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using (
  (org_id is null and owner_id = auth.uid())
  or (org_id = auth_org())
  or auth_role() = 'superadmin'
);
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated with check (
  is_active() and (
    (org_id is null and owner_id = auth.uid() and is_org_wide = false)
    or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (is_org_wide = false and owner_id = auth.uid())))
  )
);
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated using (
  (org_id is null and owner_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or owner_id = auth.uid()))
) with check (
  (org_id is null and owner_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or owner_id = auth.uid()))
);

-- documents (owner: employee_id)
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
  or auth_role() = 'superadmin'
);
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated with check (
  is_active() and (
    (org_id is null and employee_id = auth.uid())
    or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]))
  )
);
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = 'draft')))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
);

-- official_documents (owner: employee_id)
drop policy if exists official_docs_select on public.official_documents;
create policy official_docs_select on public.official_documents for select to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
  or auth_role() = 'superadmin'
);
drop policy if exists official_docs_insert on public.official_documents;
create policy official_docs_insert on public.official_documents for insert to authenticated with check (
  is_active() and (
    (org_id is null and employee_id = auth.uid())
    or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]))
  )
);
drop policy if exists official_docs_update on public.official_documents;
create policy official_docs_update on public.official_documents for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
);

-- leave_types (owner: user_id for personal; org template otherwise)
drop policy if exists leave_types_select on public.leave_types;
create policy leave_types_select on public.leave_types for select to authenticated using (
  (org_id is null and user_id = auth.uid())
  or (org_id = auth_org())
  or auth_role() = 'superadmin'
);
drop policy if exists leave_types_insert on public.leave_types;
create policy leave_types_insert on public.leave_types for insert to authenticated with check (
  is_active() and (
    (org_id is null and user_id = auth.uid())
    or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]))
  )
);
drop policy if exists leave_types_update on public.leave_types;
create policy leave_types_update on public.leave_types for update to authenticated using (
  (org_id is null and user_id = auth.uid())
  or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]))
) with check (
  (org_id is null and user_id = auth.uid())
  or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]))
);
drop policy if exists leave_types_delete on public.leave_types;
create policy leave_types_delete on public.leave_types for delete to authenticated using (
  (org_id is null and user_id = auth.uid())
  or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]))
);

-- leave_balances (owner: employee_id)
drop policy if exists leave_balances_select on public.leave_balances;
create policy leave_balances_select on public.leave_balances for select to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
  or auth_role() = 'superadmin'
);
drop policy if exists leave_balances_write on public.leave_balances;
create policy leave_balances_write on public.leave_balances for all to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]))
);

-- leave_requests (owner: employee_id)
drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests for select to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
  or auth_role() = 'superadmin'
);
drop policy if exists leave_requests_insert on public.leave_requests;
create policy leave_requests_insert on public.leave_requests for insert to authenticated with check (
  is_active() and employee_id = auth.uid() and (org_id is null or org_id = auth_org())
);
drop policy if exists leave_requests_update on public.leave_requests;
create policy leave_requests_update on public.leave_requests for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = 'pending')))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
);

-- onboarding_steps (owner: employee_id)
drop policy if exists onboarding_select on public.onboarding_steps;
create policy onboarding_select on public.onboarding_steps for select to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
  or auth_role() = 'superadmin'
);
drop policy if exists onboarding_insert on public.onboarding_steps;
create policy onboarding_insert on public.onboarding_steps for insert to authenticated with check (
  is_active() and (
    (org_id is null and employee_id = auth.uid())
    or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
  )
);
drop policy if exists onboarding_update on public.onboarding_steps;
create policy onboarding_update on public.onboarding_steps for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or employee_id = auth.uid()))
);

-- audit_log — M1 fix (drop forgeable insert); org-manager + superadmin read
drop policy if exists "authenticated insert audit" on public.audit_log;
drop policy if exists "admin reads org audit" on public.audit_log;
drop policy if exists audit_log_select on public.audit_log;
drop policy if exists "superadmin reads all audit" on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using (
  auth_role() = 'superadmin'
  or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]) and is_active())
);

-- webhook_deliveries — consolidate to one read (org-manager + superadmin)
drop policy if exists webhook_deliveries_select on public.webhook_deliveries;
drop policy if exists webhook_select on public.webhook_deliveries;
create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated using (
  auth_role() = 'superadmin'
  or (org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]) and is_active())
);

-- org_invites — active-org managers (invitee accept flow added in C4)
drop policy if exists org_invites_select on public.org_invites;
create policy org_invites_select on public.org_invites for select to authenticated using (
  org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]) and is_active()
);
drop policy if exists org_invites_insert on public.org_invites;
create policy org_invites_insert on public.org_invites for insert to authenticated with check (
  org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]) and is_active() and invited_by = auth.uid()
);
drop policy if exists org_invites_delete on public.org_invites;
create policy org_invites_delete on public.org_invites for delete to authenticated using (
  org_id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[]) and is_active()
);

-- organizations — read your orgs (+superadmin all); update by active-org manager
drop policy if exists "members read own org" on public.organizations;
create policy organizations_select on public.organizations for select to authenticated using (
  id in (select public.my_org_ids()) or auth_role() = 'superadmin'
);
drop policy if exists "admin updates own org" on public.organizations;
create policy organizations_update on public.organizations for update to authenticated using (
  id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[])
) with check (
  id = auth_org() and auth_workspace_role() = any(array['owner','admin']::user_role[])
);
-- NOTE: "superadmin full org access" (ALL) is preserved; org creation is the
-- create_organization() RPC (C1). No authenticated INSERT policy here.

-- profiles — rewrite only the two admin-org policies (membership-based).
-- "read own profile" / "update own profile basics" / "superadmin full profile
-- access" + the C1 guard trigger + column grants are PRESERVED untouched.
drop policy if exists "admin reads org profiles" on public.profiles;
create policy "managers read active org member profiles" on public.profiles for select to authenticated using (
  auth_workspace_role() = any(array['owner','admin']::user_role[])
  and id in (select public.active_org_member_ids())
);
drop policy if exists "admin manages org profiles" on public.profiles;
create policy "managers update active org member profiles" on public.profiles for update to authenticated using (
  auth_workspace_role() = any(array['owner','admin']::user_role[])
  and id in (select public.active_org_member_ids())
) with check (
  auth_workspace_role() = any(array['owner','admin']::user_role[])
  and id in (select public.active_org_member_ids())
);
