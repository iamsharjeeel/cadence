-- Link time entries to imported Asana projects (additive metadata, not Cadence projects)

ALTER TABLE asana_connections
  ADD COLUMN IF NOT EXISTS project_names_synced_at timestamptz;

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS asana_project_id uuid
    REFERENCES asana_imported_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS time_entries_asana_project_id_idx
  ON time_entries (asana_project_id)
  WHERE asana_project_id IS NOT NULL;
