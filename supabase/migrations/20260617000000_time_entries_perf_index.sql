-- Composite index for overlap checks and week loads by employee + date.
-- Run in Supabase SQL editor if week entry loads feel slow.
create index if not exists time_entries_employee_date_idx
  on time_entries (employee_id, entry_date);
