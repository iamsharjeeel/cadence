-- Security hardening: core RLS, storage policies, RPC authorization

-- ---------------------------------------------------------------------------
-- Timesheets bucket (private, org-scoped read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('timesheets', 'timesheets', false)
on conflict (id) do nothing;

drop policy if exists "timesheets_storage_select" on storage.objects;
create policy "timesheets_storage_select" on storage.objects for select using (
  bucket_id = 'timesheets' and (
    auth_role() = 'superadmin' or (
      (storage.foldername(name))[1] = auth_org()::text and (
        auth_role() in ('admin', 'superadmin') or
        (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
);

drop policy if exists "timesheets_storage_insert" on storage.objects;
create policy "timesheets_storage_insert" on storage.objects for insert with check (
  bucket_id = 'timesheets' and
  is_active() and
  (storage.foldername(name))[1] = auth_org()::text and
  (storage.foldername(name))[2] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- Documents storage — tighten insert to org folder + active user
-- ---------------------------------------------------------------------------
drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert" on storage.objects for insert with check (
  bucket_id = 'documents' and
  is_active() and (
    auth_role() = 'superadmin' or
    (storage.foldername(name))[1] = auth_org()::text
  )
);

drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select" on storage.objects for select using (
  bucket_id = 'documents' and (
    auth_role() = 'superadmin' or (
      (storage.foldername(name))[1] = auth_org()::text and (
        auth_role() in ('admin', 'superadmin') or
        (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- Documents table — restrict insert to admin/superadmin
-- ---------------------------------------------------------------------------
drop policy if exists "documents_insert" on documents;
create policy "documents_insert" on documents for insert with check (
  org_id = auth_org() and
  is_active() and
  auth_role() in ('admin', 'superadmin')
);

drop policy if exists "documents_update" on documents;
create policy "documents_update" on documents for update using (
  org_id = auth_org() and is_active() and (
    auth_role() in ('admin', 'superadmin') or
    (employee_id = auth.uid() and status = 'draft')
  )
);

-- ---------------------------------------------------------------------------
-- Official documents storage — org-scoped
-- ---------------------------------------------------------------------------
drop policy if exists "official_docs_upload" on storage.objects;
drop policy if exists "official_docs_read" on storage.objects;

create policy "official_docs_storage_insert" on storage.objects for insert with check (
  bucket_id = 'official-documents' and
  is_active() and
  auth_role() in ('admin', 'superadmin') and (
    auth_role() = 'superadmin' or
    (storage.foldername(name))[1] = auth_org()::text
  )
);

create policy "official_docs_storage_select" on storage.objects for select using (
  bucket_id = 'official-documents' and (
    auth_role() = 'superadmin' or (
      (storage.foldername(name))[1] = auth_org()::text and (
        auth_role() in ('admin', 'superadmin') or
        (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- Org logos — write restricted to admin/superadmin in own org folder
-- ---------------------------------------------------------------------------
drop policy if exists "org_logos_upload" on storage.objects;
drop policy if exists "org_logos_update" on storage.objects;
drop policy if exists "org_logos_delete" on storage.objects;

create policy "org_logos_upload" on storage.objects for insert with check (
  bucket_id = 'org-logos' and
  is_active() and
  auth_role() in ('admin', 'superadmin') and (
    auth_role() = 'superadmin' or
    (storage.foldername(name))[1] = auth_org()::text
  )
);

create policy "org_logos_update" on storage.objects for update using (
  bucket_id = 'org-logos' and
  is_active() and
  auth_role() in ('admin', 'superadmin') and (
    auth_role() = 'superadmin' or
    (storage.foldername(name))[1] = auth_org()::text
  )
);

create policy "org_logos_delete" on storage.objects for delete using (
  bucket_id = 'org-logos' and
  is_active() and
  auth_role() in ('admin', 'superadmin') and (
    auth_role() = 'superadmin' or
    (storage.foldername(name))[1] = auth_org()::text
  )
);

-- ---------------------------------------------------------------------------
-- Leave types — require active admin/superadmin for writes
-- ---------------------------------------------------------------------------
drop policy if exists "leave_types_write" on leave_types;
create policy "leave_types_insert" on leave_types for insert with check (
  org_id = auth_org() and is_active() and auth_role() in ('admin', 'superadmin')
);
create policy "leave_types_update" on leave_types for update using (
  org_id = auth_org() and is_active() and auth_role() in ('admin', 'superadmin')
);
create policy "leave_types_delete" on leave_types for delete using (
  org_id = auth_org() and is_active() and auth_role() in ('admin', 'superadmin')
);

-- ---------------------------------------------------------------------------
-- Leave RPCs — authorize caller inside SECURITY DEFINER functions
-- ---------------------------------------------------------------------------
create or replace function approve_leave_request(p_request_id uuid, p_reviewer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r leave_requests%rowtype;
  yr int;
  reviewer_role text;
  reviewer_org uuid;
begin
  select role, org_id into reviewer_role, reviewer_org
  from profiles where id = p_reviewer_id;
  if reviewer_role not in ('admin', 'superadmin') then
    raise exception 'Forbidden';
  end if;

  select * into r from leave_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request is not pending'; end if;
  if reviewer_role = 'admin' and r.org_id <> reviewer_org then
    raise exception 'Forbidden';
  end if;

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
  reviewer_role text;
  reviewer_org uuid;
begin
  select role, org_id into reviewer_role, reviewer_org
  from profiles where id = p_reviewer_id;
  if reviewer_role not in ('admin', 'superadmin') then
    raise exception 'Forbidden';
  end if;

  select * into r from leave_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request is not pending'; end if;
  if reviewer_role = 'admin' and r.org_id <> reviewer_org then
    raise exception 'Forbidden';
  end if;

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

revoke all on function approve_leave_request(uuid, uuid) from public;
revoke all on function reject_leave_request(uuid, uuid, text) from public;
grant execute on function approve_leave_request(uuid, uuid) to authenticated;
grant execute on function reject_leave_request(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Onboarding steps — employees can insert/update own rows only (no delete)
-- ---------------------------------------------------------------------------
drop policy if exists "onboarding_write" on onboarding_steps;
create policy "onboarding_insert" on onboarding_steps for insert with check (
  org_id = auth_org() and is_active() and (
    auth_role() in ('admin', 'superadmin') or employee_id = auth.uid()
  )
);
create policy "onboarding_update" on onboarding_steps for update using (
  org_id = auth_org() and is_active() and (
    auth_role() in ('admin', 'superadmin') or employee_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Webhook deliveries — admin reads own org, superadmin reads all
-- ---------------------------------------------------------------------------
alter table webhook_deliveries enable row level security;

drop policy if exists "webhook_deliveries_select" on webhook_deliveries;
create policy "webhook_deliveries_select" on webhook_deliveries for select using (
  auth_role() = 'superadmin' or (
    org_id = auth_org() and auth_role() in ('admin', 'superadmin') and is_active()
  )
);

-- Audit log — read-only for admin/superadmin (no client writes)
alter table audit_log enable row level security;

drop policy if exists "audit_log_select" on audit_log;
create policy "audit_log_select" on audit_log for select using (
  auth_role() = 'superadmin' or (
    org_id = auth_org() and auth_role() in ('admin', 'superadmin') and is_active()
  )
);
