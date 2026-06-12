-- Task C: Track how many times a timesheet was returned from rejection to draft.
-- Used to show a "Resubmitted" label in the manager queue.
ALTER TABLE timesheets
  ADD COLUMN IF NOT EXISTS resubmit_count smallint NOT NULL DEFAULT 0;
