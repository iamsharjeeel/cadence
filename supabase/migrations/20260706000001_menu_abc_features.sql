-- Menu A/B/C: time entry rejection, expenses, API key scopes, webhook retry scheduling, L1 anon hardening

alter table public.time_entries
  drop constraint if exists time_entries_status_check;

alter table public.time_entries
  add constraint time_entries_status_check
  check (status in ('pending_approval', 'approved', 'rejected'));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD',
  description text not null,
  expense_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_org_status_idx
  on public.expenses (org_id, status)
  where status = 'pending';

alter table public.expenses enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated using (
  (org_id is not null and org_id = public.auth_org())
  or employee_id = auth.uid()
  or public.auth_role() = 'superadmin'
);

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check (
  employee_id = auth.uid()
  and org_id = public.auth_org()
  and org_id is not null
);

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated using (
  (org_id = public.auth_org() and public.auth_workspace_role() in ('owner', 'admin'))
  or (employee_id = auth.uid() and status = 'pending')
);

alter table public.api_keys
  add column if not exists permission text not null default 'full';

alter table public.api_keys
  drop constraint if exists api_keys_permission_check;

alter table public.api_keys
  add constraint api_keys_permission_check
  check (permission in ('read_only', 'full'));

alter table public.webhook_deliveries
  add column if not exists next_retry_at timestamptz;

do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format(
      'revoke insert, update, delete on public.%I from anon',
      r.tablename
    );
  end loop;
end $$;
