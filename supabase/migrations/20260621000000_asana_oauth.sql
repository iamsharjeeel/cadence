-- Per-user Asana OAuth connections + imported projects (run in Supabase SQL editor)

CREATE TABLE IF NOT EXISTS asana_connections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  access_token_enc      text NOT NULL,
  refresh_token_enc     text NOT NULL,
  expires_at            timestamptz NOT NULL,
  asana_user_gid        text,
  asana_user_name       text,
  asana_user_email      text,
  connected_at          timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asana_imported_projects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asana_project_gid     text NOT NULL,
  asana_project_name    text NOT NULL,
  asana_workspace_gid   text NOT NULL,
  asana_workspace_name  text,
  imported_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asana_imported_projects_user_project_unique
    UNIQUE (user_id, asana_project_gid)
);

CREATE INDEX IF NOT EXISTS asana_imported_projects_user_idx
  ON asana_imported_projects (user_id);

ALTER TABLE asana_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE asana_imported_projects ENABLE ROW LEVEL SECURITY;

-- Connections: users read/delete own row; token writes are server-only (service role).
DROP POLICY IF EXISTS asana_connections_select ON asana_connections;
CREATE POLICY asana_connections_select ON asana_connections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS asana_connections_delete ON asana_connections;
CREATE POLICY asana_connections_delete ON asana_connections
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Imported projects: full CRUD on own rows.
DROP POLICY IF EXISTS asana_imported_projects_select ON asana_imported_projects;
CREATE POLICY asana_imported_projects_select ON asana_imported_projects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS asana_imported_projects_insert ON asana_imported_projects;
CREATE POLICY asana_imported_projects_insert ON asana_imported_projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS asana_imported_projects_update ON asana_imported_projects;
CREATE POLICY asana_imported_projects_update ON asana_imported_projects
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS asana_imported_projects_delete ON asana_imported_projects;
CREATE POLICY asana_imported_projects_delete ON asana_imported_projects
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
