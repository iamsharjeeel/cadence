-- Ensure org-logos public bucket exists (idempotent)

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "org_logos_upload" on storage.objects;
drop policy if exists "org_logos_update" on storage.objects;
drop policy if exists "org_logos_delete" on storage.objects;
drop policy if exists "org_logos_read" on storage.objects;

create policy "org_logos_read" on storage.objects for select
  using (bucket_id = 'org-logos');

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
