-- B1: Add 'owner' to user_role enum.
-- Run this in Supabase SQL Editor BEFORE deploying the code changes.
-- owner sits below superadmin and above admin (Manager) in the hierarchy.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';

-- B3: RLS updates — owner is a superset of admin in all existing policies.
-- Must run AFTER the ALTER TYPE above (separate statement, not same transaction).

-- ── profiles ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin reads org profiles" ON profiles;
CREATE POLICY "admin reads org profiles" ON profiles FOR SELECT USING (
  org_id = auth_org() AND auth_role() IN ('admin', 'owner')
);

DROP POLICY IF EXISTS "admin manages org profiles" ON profiles;
CREATE POLICY "admin manages org profiles" ON profiles FOR UPDATE USING (
  org_id = auth_org() AND auth_role() IN ('admin', 'owner')
) WITH CHECK (
  org_id = auth_org() AND auth_role() IN ('admin', 'owner')
);

-- Owner-specific: can explicitly read/update Manager (admin) profiles in their org.
-- Managers (admin) rely on the general "admin manages org profiles" policy above;
-- this policy makes the owner capability explicit as a separate grant.
DROP POLICY IF EXISTS "owner manages manager profiles" ON profiles;
CREATE POLICY "owner manages manager profiles" ON profiles FOR UPDATE USING (
  org_id = auth_org() AND auth_role() = 'owner' AND role = 'admin'
) WITH CHECK (
  org_id = auth_org() AND auth_role() = 'owner'
);

-- ── documents ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT USING (
  org_id = auth_org() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (
  org_id = auth_org() AND is_active() AND auth_role() IN ('admin', 'owner', 'superadmin')
);

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents FOR UPDATE USING (
  org_id = auth_org() AND is_active() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR
    (employee_id = auth.uid() AND status = 'draft')
  )
);

-- ── leave ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leave_types_write" ON leave_types;
DROP POLICY IF EXISTS "leave_types_insert" ON leave_types;
DROP POLICY IF EXISTS "leave_types_update" ON leave_types;
DROP POLICY IF EXISTS "leave_types_delete" ON leave_types;
CREATE POLICY "leave_types_insert" ON leave_types FOR INSERT WITH CHECK (
  org_id = auth_org() AND is_active() AND auth_role() IN ('admin', 'owner', 'superadmin')
);
CREATE POLICY "leave_types_update" ON leave_types FOR UPDATE USING (
  org_id = auth_org() AND is_active() AND auth_role() IN ('admin', 'owner', 'superadmin')
);
CREATE POLICY "leave_types_delete" ON leave_types FOR DELETE USING (
  org_id = auth_org() AND is_active() AND auth_role() IN ('admin', 'owner', 'superadmin')
);

DROP POLICY IF EXISTS "leave_balances_write" ON leave_balances;
CREATE POLICY "leave_balances_write" ON leave_balances FOR ALL USING (
  org_id = auth_org() AND auth_role() IN ('admin', 'owner', 'superadmin')
);

DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE USING (
  org_id = auth_org() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR
    (employee_id = auth.uid() AND status = 'pending')
  )
);

DROP POLICY IF EXISTS "leave_balances_select" ON leave_balances;
CREATE POLICY "leave_balances_select" ON leave_balances FOR SELECT USING (
  org_id = auth_org() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT USING (
  org_id = auth_org() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);

-- ── official documents ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "official_docs_select" ON official_documents;
CREATE POLICY "official_docs_select" ON official_documents FOR SELECT USING (
  org_id = auth_org() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "official_docs_insert" ON official_documents;
CREATE POLICY "official_docs_insert" ON official_documents FOR INSERT WITH CHECK (
  org_id = auth_org() AND auth_role() IN ('admin', 'owner', 'superadmin')
);

DROP POLICY IF EXISTS "official_docs_update" ON official_documents;
CREATE POLICY "official_docs_update" ON official_documents FOR UPDATE USING (
  org_id = auth_org() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);

-- ── onboarding ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "onboarding_write" ON onboarding_steps;
DROP POLICY IF EXISTS "onboarding_insert" ON onboarding_steps;
DROP POLICY IF EXISTS "onboarding_update" ON onboarding_steps;
CREATE POLICY "onboarding_insert" ON onboarding_steps FOR INSERT WITH CHECK (
  org_id = auth_org() AND is_active() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);
CREATE POLICY "onboarding_update" ON onboarding_steps FOR UPDATE USING (
  org_id = auth_org() AND is_active() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "onboarding_select" ON onboarding_steps;
CREATE POLICY "onboarding_select" ON onboarding_steps FOR SELECT USING (
  org_id = auth_org() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);

-- ── projects ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (
  org_id = auth_org() AND is_active() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR
    (NOT is_org_wide AND owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
  org_id = auth_org() AND is_active() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "time_entries_select" ON time_entries;
CREATE POLICY "time_entries_select" ON time_entries FOR SELECT USING (
  org_id = auth_org() AND (
    auth_role() IN ('admin', 'owner', 'superadmin') OR employee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "time_entries_update" ON time_entries;
CREATE POLICY "time_entries_update" ON time_entries FOR UPDATE USING (
  org_id = auth_org() AND (
    employee_id = auth.uid() OR auth_role() IN ('admin', 'owner', 'superadmin')
  )
);

-- ── storage: timesheets ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "timesheets_storage_select" ON storage.objects;
CREATE POLICY "timesheets_storage_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'timesheets' AND (
    auth_role() = 'superadmin' OR (
      (storage.foldername(name))[1] = auth_org()::text AND (
        auth_role() IN ('admin', 'owner', 'superadmin') OR
        (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
);

-- ── storage: documents ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;
CREATE POLICY "documents_storage_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND (
    auth_role() = 'superadmin' OR (
      (storage.foldername(name))[1] = auth_org()::text AND (
        auth_role() IN ('admin', 'owner', 'superadmin') OR
        (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
);

-- ── storage: official documents ───────────────────────────────────────────────
DROP POLICY IF EXISTS "official_docs_storage_insert" ON storage.objects;
CREATE POLICY "official_docs_storage_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'official-documents' AND is_active() AND
  auth_role() IN ('admin', 'owner', 'superadmin') AND (
    auth_role() = 'superadmin' OR
    (storage.foldername(name))[1] = auth_org()::text
  )
);

DROP POLICY IF EXISTS "official_docs_storage_select" ON storage.objects;
CREATE POLICY "official_docs_storage_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'official-documents' AND (
    auth_role() = 'superadmin' OR (
      (storage.foldername(name))[1] = auth_org()::text AND (
        auth_role() IN ('admin', 'owner', 'superadmin') OR
        (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
);

-- ── storage: org logos ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "org_logos_upload" ON storage.objects;
DROP POLICY IF EXISTS "org_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "org_logos_delete" ON storage.objects;

CREATE POLICY "org_logos_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'org-logos' AND is_active() AND
  auth_role() IN ('admin', 'owner', 'superadmin') AND (
    auth_role() = 'superadmin' OR
    (storage.foldername(name))[1] = auth_org()::text
  )
);
CREATE POLICY "org_logos_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'org-logos' AND is_active() AND
  auth_role() IN ('admin', 'owner', 'superadmin') AND (
    auth_role() = 'superadmin' OR
    (storage.foldername(name))[1] = auth_org()::text
  )
);
CREATE POLICY "org_logos_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'org-logos' AND is_active() AND
  auth_role() IN ('admin', 'owner', 'superadmin') AND (
    auth_role() = 'superadmin' OR
    (storage.foldername(name))[1] = auth_org()::text
  )
);

-- ── webhook_deliveries + audit_log ────────────────────────────────────────────
DROP POLICY IF EXISTS "webhook_deliveries_select" ON webhook_deliveries;
CREATE POLICY "webhook_deliveries_select" ON webhook_deliveries FOR SELECT USING (
  auth_role() = 'superadmin' OR (
    org_id = auth_org() AND auth_role() IN ('admin', 'owner', 'superadmin') AND is_active()
  )
);

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT USING (
  auth_role() = 'superadmin' OR (
    org_id = auth_org() AND auth_role() IN ('admin', 'owner', 'superadmin') AND is_active()
  )
);

-- ── RPCs: approve_leave_request / reject_leave_request ────────────────────────
-- Update the security definer functions to also permit 'owner' role.
CREATE OR REPLACE FUNCTION approve_leave_request(p_request_id uuid, p_reviewer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r leave_requests%rowtype;
  yr int;
  reviewer_role text;
  reviewer_org uuid;
BEGIN
  SELECT role, org_id INTO reviewer_role, reviewer_org
  FROM profiles WHERE id = p_reviewer_id;
  IF reviewer_role NOT IN ('admin', 'owner', 'superadmin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO r FROM leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  IF reviewer_role IN ('admin', 'owner') AND r.org_id <> reviewer_org THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  yr := EXTRACT(YEAR FROM r.start_date)::int;

  UPDATE leave_balances
  SET used_days = used_days + r.days_requested,
      pending_days = pending_days - r.days_requested
  WHERE employee_id = r.employee_id
    AND leave_type_id = r.leave_type_id
    AND year = yr;

  UPDATE leave_requests
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_leave_request(
  p_request_id uuid, p_reviewer_id uuid, p_note text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r leave_requests%rowtype;
  yr int;
  reviewer_role text;
  reviewer_org uuid;
BEGIN
  SELECT role, org_id INTO reviewer_role, reviewer_org
  FROM profiles WHERE id = p_reviewer_id;
  IF reviewer_role NOT IN ('admin', 'owner', 'superadmin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO r FROM leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  IF reviewer_role IN ('admin', 'owner') AND r.org_id <> reviewer_org THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  yr := EXTRACT(YEAR FROM r.start_date)::int;

  UPDATE leave_balances
  SET pending_days = pending_days - r.days_requested
  WHERE employee_id = r.employee_id
    AND leave_type_id = r.leave_type_id
    AND year = yr;

  UPDATE leave_requests
  SET status = 'rejected',
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      rejection_note = p_note,
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION approve_leave_request(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION reject_leave_request(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION approve_leave_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_leave_request(uuid, uuid, text) TO authenticated;
