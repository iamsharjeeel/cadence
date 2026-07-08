-- =====================================================================
-- Fix: restore status guards on the employee (self) branch of three
-- UPDATE policies' WITH CHECK clauses, closing a self-approval hole
-- introduced by the Track-C2 rewrite (20260628000000).
-- =====================================================================
-- Bug: for timesheets_update and documents_update, the USING clause
-- correctly restricts an employee to updating their OWN rows only while
-- those rows are in a pre-approval state (status = draft/rejected), but
-- the WITH CHECK clause's employee branch dropped that predicate. Since
-- WITH CHECK governs the RESULTING row of an UPDATE, an employee could
-- run `UPDATE timesheets SET status = 'approved' WHERE id = <own row>`
-- (or the documents equivalent, flipping a draft pay-advice/invoice to
-- 'verified') with nothing but their own JWT — self-approval / payroll
-- fraud, bypassing the owner/admin approval step entirely.
--
-- time_entries_update never had a status predicate on either USING or
-- WITH CHECK for the employee branch. The `status` column (pending_
-- approval / approved / rejected, default 'approved') was added later in
-- 20260630000001_time_entries_approval_status.sql and
-- 20260706000001_menu_abc_features.sql, but the update policy already in
-- place at that point (from 20260628000000) was never revisited, leaving
-- the same self-approval hole for logged hours. This mirrors how
-- expenses_update (also added in 20260706000001_menu_abc_features.sql)
-- already guards its employee branch: `employee_id = auth.uid() and
-- status = 'pending'`. For time_entries we allow the employee branch on
-- both 'pending_approval' and 'rejected' (pre-approval / resubmit states,
-- matching the draft/rejected pattern used by timesheets and
-- timesheet_rows) but never 'approved' — an employee can never read-for-
-- update nor write a result of 'approved' via their own-row branch; only
-- the org's owner/admin branch (auth_workspace_role() in owner/admin) can
-- set status to 'approved'.
--
-- Every other branch (personal org_id-is-null ownership, superadmin,
-- owner/admin) is copied verbatim from the live 20260628000000 policy
-- bodies — only the employee self-branch gains the status restriction.
-- This is a NEW forward migration; the historical 20260628000000 file is
-- immutable (already applied to prod) and is not edited in place.
-- =====================================================================

-- timesheets_update: restore status predicate on WITH CHECK employee branch
drop policy if exists timesheets_update on public.timesheets;
create policy timesheets_update on public.timesheets for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = any(array['draft','rejected']))))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = any(array['draft','rejected']))))
);

-- documents_update: restore status = 'draft' predicate on WITH CHECK employee branch
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = 'draft')))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = 'draft')))
);

-- time_entries_update: add a status backstop that never existed before.
-- Employee self-branch (org-scoped) may only touch rows in a pre-approval
-- state (pending_approval/rejected) and can never read-for-update nor
-- write a result of 'approved' through this branch; the personal
-- (org_id is null) branch and the owner/admin branch are unchanged.
drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries for update to authenticated using (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = any(array['pending_approval','rejected']))))
) with check (
  (org_id is null and employee_id = auth.uid())
  or (org_id = auth_org() and (auth_workspace_role() = any(array['owner','admin']::user_role[]) or (employee_id = auth.uid() and status = any(array['pending_approval','rejected']))))
);
