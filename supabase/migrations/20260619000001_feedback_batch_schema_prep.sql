-- Repo parity only — already applied on production Supabase (irybkcryeywmwpcmhlaa).

ALTER TYPE period_cadence ADD VALUE IF NOT EXISTS 'biweekly_15';

ALTER TABLE leave_requests
  ALTER COLUMN leave_type_id DROP NOT NULL;

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS google_event_id text;
