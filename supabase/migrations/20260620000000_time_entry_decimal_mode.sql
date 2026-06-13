-- Decimal-hours entry mode + synthetic start/end support

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS entry_mode text NOT NULL DEFAULT 'time_range'
    CHECK (entry_mode IN ('time_range', 'decimal_hours'));

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS decimal_hours numeric;

COMMENT ON COLUMN time_entries.entry_mode IS
  'time_range = user-entered start/end; decimal_hours = UI shows decimal_hours only, start/end are synthetic for generated total_hours';

COMMENT ON COLUMN time_entries.decimal_hours IS
  'Stored decimal when entry_mode = decimal_hours; start_time/end_time are synthetic (00:00 + offset)';
