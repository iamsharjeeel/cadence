-- Preview ghost / invalid time_entries (null/blank times or zero duration).
-- Run SELECT first; review rows; then run DELETE if expected.

-- SELECT (preview)
select id, org_id, employee_id, timesheet_id, entry_date, start_time, end_time, project_id, created_at
from time_entries
where start_time is null
   or end_time is null
   or trim(start_time::text) = ''
   or trim(end_time::text) = ''
   or (start_time = end_time and start_time is not null);

-- DELETE (only after reviewing SELECT results)
-- delete from time_entries
-- where start_time is null
--    or end_time is null
--    or trim(start_time::text) = ''
--    or trim(end_time::text) = ''
--    or (start_time = end_time and start_time is not null);
