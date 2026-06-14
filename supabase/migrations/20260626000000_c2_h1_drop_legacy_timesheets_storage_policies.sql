-- =============================================================================
-- SECURITY FIX C2 (CRITICAL) + H1 (HIGH) -- timesheets storage bucket lockdown
-- =============================================================================
-- Finding (SECURITY_AUDIT.md -> C2 / H1): the private `timesheets` storage
-- bucket carried two legacy policies scoped only to auth.role()='authenticated'
-- with NO org/path predicate:
--     ts_read   (SELECT)  USING      (bucket_id='timesheets' AND auth.role()='authenticated')
--     ts_upload (INSERT)  WITH CHECK (bucket_id='timesheets' AND auth.role()='authenticated')
-- Storage RLS policies are PERMISSIVE (OR'd), so these legacy policies overrode
-- the correctly-scoped timesheets_storage_select / timesheets_storage_insert:
-- ANY authenticated user (including a fresh org_id=NULL signup, or a member of a
-- different org) could read/download (C2) AND write/overwrite (H1) every org's
-- raw timesheet/payroll files.
--
-- Fix: drop both legacy policies. The scoped policies remain and already enforce
-- org-by-path isolation (foldername = {org_id}/{user_id}/...):
--     timesheets_storage_select  USING (bucket_id='timesheets' AND
--        (auth_role()='superadmin' OR (foldername[1]=auth_org()::text AND
--         (auth_role() IN ('admin','superadmin') OR foldername[2]=auth.uid()::text))))
--     timesheets_storage_insert  WITH CHECK (bucket_id='timesheets' AND is_active()
--         AND foldername[1]=auth_org()::text AND foldername[2]=auth.uid()::text)
--
-- Idempotent: safe to re-run.
-- =============================================================================

DROP POLICY IF EXISTS "ts_read"   ON storage.objects;
DROP POLICY IF EXISTS "ts_upload" ON storage.objects;
