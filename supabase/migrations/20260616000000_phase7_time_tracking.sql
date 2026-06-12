-- Phase 7: In-app time tracking — projects + time entries

create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  owner_id    uuid references profiles(id) on delete set null,
  name        text not null,
  color       text not null default '#1F8A8A',
  is_org_wide boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists projects_org_id_idx on projects (org_id);
create index if not exists projects_owner_id_idx on projects (owner_id);

create table if not exists time_entries (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  employee_id  uuid not null references profiles(id) on delete cascade,
  timesheet_id uuid references timesheets(id) on delete set null,
  project_id   uuid references projects(id) on delete set null,
  entry_date   date not null,
  start_time   time not null,
  end_time     time not null,
  is_overnight boolean not null default false,
  total_hours  numeric not null,
  description  text,
  billable     boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint time_entries_valid_range check (
    is_overnight or end_time > start_time
  )
);

create index if not exists time_entries_org_id_idx on time_entries (org_id);
create index if not exists time_entries_employee_id_idx on time_entries (employee_id);
create index if not exists time_entries_timesheet_id_idx on time_entries (timesheet_id);
create index if not exists time_entries_entry_date_idx on time_entries (entry_date);

create or replace function public.set_time_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists time_entries_updated_at on time_entries;
create trigger time_entries_updated_at
  before update on time_entries
  for each row execute function public.set_time_entries_updated_at();

alter table projects enable row level security;
alter table time_entries enable row level security;

-- Projects
drop policy if exists "projects_select" on projects;
create policy "projects_select" on projects for select using (
  org_id = auth_org() and is_active()
);

drop policy if exists "projects_insert" on projects;
create policy "projects_insert" on projects for insert with check (
  org_id = auth_org() and is_active() and (
    auth_role() in ('admin', 'superadmin') or
    (is_org_wide = false and owner_id = auth.uid())
  )
);

drop policy if exists "projects_update" on projects;
create policy "projects_update" on projects for update using (
  org_id = auth_org() and (
    auth_role() in ('admin', 'superadmin') or owner_id = auth.uid()
  )
);

-- Time entries
drop policy if exists "time_entries_select" on time_entries;
create policy "time_entries_select" on time_entries for select using (
  org_id = auth_org() and (
    auth_role() in ('admin', 'superadmin') or employee_id = auth.uid()
  )
);

drop policy if exists "time_entries_insert" on time_entries;
create policy "time_entries_insert" on time_entries for insert with check (
  org_id = auth_org() and employee_id = auth.uid() and is_active()
);

drop policy if exists "time_entries_update" on time_entries;
create policy "time_entries_update" on time_entries for update using (
  org_id = auth_org() and (
    employee_id = auth.uid() or auth_role() in ('admin', 'superadmin')
  )
);

drop policy if exists "time_entries_delete" on time_entries;
create policy "time_entries_delete" on time_entries for delete using (
  org_id = auth_org() and employee_id = auth.uid() and
  exists (
    select 1 from timesheets t
    where t.id = time_entries.timesheet_id
    and t.status in ('draft', 'rejected')
  )
);
