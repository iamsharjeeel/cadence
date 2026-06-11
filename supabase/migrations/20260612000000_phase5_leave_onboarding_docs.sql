-- Phase 5: Leave management, onboarding, official documents

-- Leave types
create table if not exists leave_types (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id) on delete cascade,
  name                 text not null,
  category             text not null check (category in ('annual','sick','unpaid','public_holiday','custom')),
  default_days_per_year numeric,
  color                text default '#1F8A8A',
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);

create table if not exists leave_balances (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  employee_id    uuid not null references profiles(id) on delete cascade,
  leave_type_id  uuid not null references leave_types(id) on delete cascade,
  year           int not null,
  allocated_days numeric not null default 0,
  used_days      numeric not null default 0,
  pending_days   numeric not null default 0,
  created_at     timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

create table if not exists leave_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  employee_id     uuid not null references profiles(id) on delete cascade,
  leave_type_id   uuid not null references leave_types(id) on delete cascade,
  start_date      date not null,
  end_date        date not null,
  days_requested  numeric not null,
  half_day        boolean not null default false,
  note            text,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  rejection_note  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists onboarding_steps (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  employee_id  uuid not null references profiles(id) on delete cascade,
  step         text not null check (step in (
                 'personal','banking','employment','emergency','documents','complete'
               )),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (employee_id, step)
);

alter table profiles
  add column if not exists job_title text,
  add column if not exists start_date date,
  add column if not exists emergency_name text,
  add column if not exists emergency_phone text,
  add column if not exists emergency_relation text,
  add column if not exists onboarding_complete boolean not null default false;

create table if not exists official_documents (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  employee_id      uuid references profiles(id) on delete cascade,
  uploaded_by      uuid not null references profiles(id),
  name             text not null,
  category         text not null check (category in (
                     'contract','offer_letter','policy','nda','other'
                   )),
  file_path        text not null,
  file_type        text not null check (file_type in ('pdf','docx')),
  signing_type     text not null check (signing_type in ('e_signature','acknowledgement')),
  status           text not null default 'pending'
                   check (status in ('pending','signed','acknowledged','rejected')),
  signed_at        timestamptz,
  signature_data   text,
  employee_note    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists leave_types_org_id_idx on leave_types(org_id);
create index if not exists leave_balances_employee_year_idx on leave_balances(employee_id, year);
create index if not exists leave_requests_org_status_idx on leave_requests(org_id, status);
create index if not exists official_documents_employee_idx on official_documents(employee_id, status);

alter table leave_types enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table onboarding_steps enable row level security;
alter table official_documents enable row level security;

create policy "leave_types_select" on leave_types for select using (
  org_id = auth_org() and is_active()
);
create policy "leave_types_write" on leave_types for all using (
  org_id = auth_org() and auth_role() in ('admin','superadmin')
);

create policy "leave_balances_select" on leave_balances for select using (
  org_id = auth_org() and (
    auth_role() in ('admin','superadmin') or employee_id = auth.uid()
  )
);
create policy "leave_balances_write" on leave_balances for all using (
  org_id = auth_org() and auth_role() in ('admin','superadmin')
);

create policy "leave_requests_select" on leave_requests for select using (
  org_id = auth_org() and (
    auth_role() in ('admin','superadmin') or employee_id = auth.uid()
  )
);
create policy "leave_requests_insert" on leave_requests for insert with check (
  org_id = auth_org() and employee_id = auth.uid() and is_active()
);
create policy "leave_requests_update" on leave_requests for update using (
  org_id = auth_org() and (
    auth_role() in ('admin','superadmin') or
    (employee_id = auth.uid() and status = 'pending')
  )
);

create policy "onboarding_select" on onboarding_steps for select using (
  org_id = auth_org() and (
    auth_role() in ('admin','superadmin') or employee_id = auth.uid()
  )
);
create policy "onboarding_write" on onboarding_steps for all using (
  org_id = auth_org() and (
    auth_role() in ('admin','superadmin') or employee_id = auth.uid()
  )
);

create policy "official_docs_select" on official_documents for select using (
  org_id = auth_org() and (
    auth_role() in ('admin','superadmin') or employee_id = auth.uid()
  )
);
create policy "official_docs_insert" on official_documents for insert with check (
  org_id = auth_org() and auth_role() in ('admin','superadmin')
);
create policy "official_docs_update" on official_documents for update using (
  org_id = auth_org() and (
    auth_role() in ('admin','superadmin') or employee_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('official-documents', 'official-documents', false)
on conflict (id) do nothing;

create policy "official_docs_upload" on storage.objects for insert
  with check (bucket_id = 'official-documents' and auth.role() = 'authenticated');

create policy "official_docs_read" on storage.objects for select
  using (bucket_id = 'official-documents' and auth.role() = 'authenticated');

-- Atomic leave approval: move pending → used in one transaction
create or replace function approve_leave_request(p_request_id uuid, p_reviewer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r leave_requests%rowtype;
  yr int;
begin
  select * into r from leave_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request is not pending'; end if;

  yr := extract(year from r.start_date)::int;

  update leave_balances
  set used_days = used_days + r.days_requested,
      pending_days = pending_days - r.days_requested
  where employee_id = r.employee_id
    and leave_type_id = r.leave_type_id
    and year = yr;

  update leave_requests
  set status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;
end;
$$;

create or replace function reject_leave_request(
  p_request_id uuid, p_reviewer_id uuid, p_note text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  r leave_requests%rowtype;
  yr int;
begin
  select * into r from leave_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request is not pending'; end if;

  yr := extract(year from r.start_date)::int;

  update leave_balances
  set pending_days = pending_days - r.days_requested
  where employee_id = r.employee_id
    and leave_type_id = r.leave_type_id
    and year = yr;

  update leave_requests
  set status = 'rejected',
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      rejection_note = p_note,
      updated_at = now()
  where id = p_request_id;
end;
$$;
