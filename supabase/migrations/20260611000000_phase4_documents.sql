-- Phase 4: banking fields on profiles + documents table + storage bucket

alter table profiles
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_bsb_swift text,
  add column if not exists tax_id text,
  add column if not exists address text,
  add column if not exists payment_terms_days int default 14;

create table if not exists documents (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  timesheet_id      uuid not null references timesheets(id) on delete cascade,
  employee_id       uuid not null references profiles(id) on delete cascade,
  type              text not null check (type in ('pay_advice', 'invoice')),
  status            text not null default 'draft'
                    check (status in ('draft', 'in_progress', 'verified', 'corrections_needed')),
  document_number   text not null,
  gst_enabled       boolean not null default false,
  gst_rate          numeric default 0.10,
  subtotal          numeric not null,
  gst_amount        numeric not null default 0,
  total             numeric not null,
  currency          text not null,
  file_path         text,
  emailed_at        timestamptz,
  generated_by      uuid references profiles(id),
  status_changed_by uuid references profiles(id),
  status_changed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists documents_org_id_idx on documents(org_id);
create index if not exists documents_timesheet_id_idx on documents(timesheet_id);
create index if not exists documents_employee_id_idx on documents(employee_id);

create or replace function next_document_number(p_org_id uuid, p_type text)
returns text language plpgsql security definer set search_path = public as $$
declare
  prefix text;
  seq_val int;
begin
  prefix := case p_type when 'invoice' then 'INV' else 'PAY' end;
  select coalesce(max(
    cast(substring(document_number from '[0-9]+$') as int)
  ), 0) + 1
  into seq_val
  from documents
  where org_id = p_org_id and type = p_type;
  return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(seq_val::text, 4, '0');
end;
$$;

alter table documents enable row level security;

drop policy if exists "documents_select" on documents;
create policy "documents_select" on documents for select using (
  org_id = auth_org() and (
    auth_role() in ('admin', 'superadmin') or employee_id = auth.uid()
  )
);

drop policy if exists "documents_insert" on documents;
create policy "documents_insert" on documents for insert with check (
  org_id = auth_org() and is_active()
);

drop policy if exists "documents_update" on documents;
create policy "documents_update" on documents for update using (
  org_id = auth_org() and (
    auth_role() in ('admin', 'superadmin') or
    (employee_id = auth.uid() and status = 'draft')
  )
);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_storage_select" on storage.objects;
create policy "documents_storage_select" on storage.objects for select using (
  bucket_id = 'documents' and (
    auth_role() = 'superadmin' or
    (storage.foldername(name))[1] = auth_org()::text
  )
);

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert" on storage.objects for insert with check (
  bucket_id = 'documents' and auth.role() = 'authenticated'
);
