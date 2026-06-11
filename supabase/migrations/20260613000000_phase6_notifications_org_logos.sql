-- Phase 6: In-app notifications + org logo storage bucket

create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  entity       text,
  entity_id    uuid,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

create policy "notifications_select" on notifications for select using (
  user_id = auth.uid()
);
create policy "notifications_update" on notifications for update using (
  user_id = auth.uid()
);

-- Public bucket for org logos
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

create policy "org_logos_upload" on storage.objects for insert
  with check (bucket_id = 'org-logos' and auth.role() = 'authenticated');

create policy "org_logos_read" on storage.objects for select
  using (bucket_id = 'org-logos');

create policy "org_logos_update" on storage.objects for update
  using (bucket_id = 'org-logos' and auth.role() = 'authenticated');

create policy "org_logos_delete" on storage.objects for delete
  using (bucket_id = 'org-logos' and auth.role() = 'authenticated');
