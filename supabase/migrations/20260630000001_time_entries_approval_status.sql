-- F2: per-entry approval status for timer / timesheet entries

alter table public.time_entries
  add column if not exists status text not null default 'approved';

alter table public.time_entries
  drop constraint if exists time_entries_status_check;

alter table public.time_entries
  add constraint time_entries_status_check
  check (status in ('pending_approval', 'approved'));

create index if not exists time_entries_status_idx
  on public.time_entries (org_id, status)
  where status = 'pending_approval';
