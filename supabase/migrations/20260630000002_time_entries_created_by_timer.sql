-- Timer provenance: distinguish timer-created entries from manual time-range logs.
-- Applied on production (irybkcryeywmwpcmhlaa); committed for repo parity only.

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS created_by_timer boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS time_entries_created_by_timer_idx
  ON time_entries (created_by_timer)
  WHERE created_by_timer = true;

COMMENT ON COLUMN time_entries.created_by_timer IS
  'True when the floating timer widget created this row on stop; false for manual weekly-log entries (including time-range mode).';
