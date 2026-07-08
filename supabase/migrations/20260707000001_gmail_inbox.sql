-- Gmail inbox sync + time entry thread linking

CREATE TABLE IF NOT EXISTS gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token_enc text NOT NULL,
  refresh_token_enc text,
  expires_at timestamptz NOT NULL,
  gmail_email text,
  history_id text,
  last_full_sync_at timestamptz,
  last_sync_at timestamptz,
  sync_status text NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'running', 'error')),
  sync_cursor_page_token text,
  threads_synced_count integer NOT NULL DEFAULT 0,
  sync_error text,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own gmail connection"
  ON gmail_connections FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS gmail_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  messages_processed integer NOT NULL DEFAULT 0,
  threads_processed integer NOT NULL DEFAULT 0,
  error text
);

ALTER TABLE gmail_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own gmail sync runs"
  ON gmail_sync_runs FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS gmail_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gmail_thread_id text NOT NULL,
  subject text,
  snippet text,
  participants jsonb NOT NULL DEFAULT '[]',
  last_message_at timestamptz NOT NULL,
  is_unread boolean NOT NULL DEFAULT false,
  label_ids jsonb NOT NULL DEFAULT '[]',
  gmail_permalink text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, gmail_thread_id)
);

ALTER TABLE gmail_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own gmail threads"
  ON gmail_threads FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_gmail_threads_user_last_message
  ON gmail_threads(user_id, last_message_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gmail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  thread_uuid uuid NOT NULL REFERENCES gmail_threads(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  from_email text,
  from_name text,
  subject text,
  snippet text,
  received_at timestamptz NOT NULL,
  body_text text,
  UNIQUE (user_id, gmail_message_id)
);

ALTER TABLE gmail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own gmail messages"
  ON gmail_messages FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_gmail_messages_thread
  ON gmail_messages(thread_uuid, received_at DESC);

CREATE TABLE IF NOT EXISTS time_entry_email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  gmail_thread_id uuid NOT NULL REFERENCES gmail_threads(id) ON DELETE CASCADE,
  linked_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (time_entry_id, gmail_thread_id)
);

ALTER TABLE time_entry_email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own time entry email links"
  ON time_entry_email_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM time_entries te
      WHERE te.id = time_entry_email_threads.time_entry_id
        AND te.employee_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM time_entries te
      JOIN memberships m ON m.org_id = te.org_id
      WHERE te.id = time_entry_email_threads.time_entry_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users insert own time entry email links"
  ON time_entry_email_threads FOR INSERT
  WITH CHECK (
    linked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM time_entries te
      WHERE te.id = time_entry_email_threads.time_entry_id
        AND te.employee_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM gmail_threads gt
      WHERE gt.id = time_entry_email_threads.gmail_thread_id
        AND gt.user_id = auth.uid()
        AND gt.deleted_at IS NULL
    )
  );

CREATE POLICY "Users delete own time entry email links"
  ON time_entry_email_threads FOR DELETE
  USING (
    linked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM time_entries te
      WHERE te.id = time_entry_email_threads.time_entry_id
        AND te.employee_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_time_entry_email_threads_entry
  ON time_entry_email_threads(time_entry_id);
