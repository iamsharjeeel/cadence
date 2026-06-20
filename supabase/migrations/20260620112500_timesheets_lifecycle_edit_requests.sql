-- Timesheet lifecycle metadata for submission/edit windows and request-edit flow.
-- Non-destructive: extends existing `timesheets` rows/columns only.

alter table public.timesheets
  add column if not exists submitted_at timestamptz,
  add column if not exists resubmit_count integer not null default 0,
  add column if not exists edit_request_status text,
  add column if not exists edit_request_note text,
  add column if not exists edit_requested_at timestamptz,
  add column if not exists edit_requested_by uuid references public.profiles(id),
  add column if not exists edit_request_reviewed_at timestamptz,
  add column if not exists edit_request_reviewed_by uuid references public.profiles(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'timesheets_edit_request_status_check'
  ) then
    alter table public.timesheets
      add constraint timesheets_edit_request_status_check
      check (
        edit_request_status is null
        or edit_request_status in ('pending', 'approved', 'rejected')
      );
  end if;
end $$;

-- Backfill best-effort submission timestamps for legacy rows.
update public.timesheets
set submitted_at = updated_at
where submitted_at is null
  and status in ('submitted', 'approved', 'rejected');

create index if not exists timesheets_period_end_status_idx
  on public.timesheets (period_end, status);

create index if not exists timesheets_edit_request_status_idx
  on public.timesheets (edit_request_status)
  where edit_request_status is not null;
