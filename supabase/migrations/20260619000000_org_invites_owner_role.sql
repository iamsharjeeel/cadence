-- Org invites + owner role (run manually in Supabase SQL editor before deploy)

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'owner';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS org_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         user_role NOT NULL DEFAULT 'employee',
  invited_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at  timestamptz,
  CONSTRAINT org_invites_role_check CHECK (role IN ('owner', 'admin', 'employee'))
);

CREATE UNIQUE INDEX IF NOT EXISTS org_invites_pending_email_org_idx
  ON org_invites (org_id, lower(email))
  WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS org_invites_email_pending_idx
  ON org_invites (lower(email))
  WHERE accepted_at IS NULL;

ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_invites_select ON org_invites;
CREATE POLICY org_invites_select ON org_invites
  FOR SELECT TO authenticated
  USING (
    org_id = auth_org()
    AND auth_role() IN ('admin', 'owner')
    AND is_active()
  );

DROP POLICY IF EXISTS org_invites_insert ON org_invites;
CREATE POLICY org_invites_insert ON org_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth_org()
    AND auth_role() IN ('admin', 'owner')
    AND is_active()
    AND invited_by = auth.uid()
  );

DROP POLICY IF EXISTS org_invites_delete ON org_invites;
CREATE POLICY org_invites_delete ON org_invites
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org()
    AND auth_role() IN ('admin', 'owner')
    AND is_active()
  );

-- Allow nullable timesheet_id on documents (orphan on timesheet delete)
ALTER TABLE documents ALTER COLUMN timesheet_id DROP NOT NULL;
