-- Add avatar_url to profiles
alter table public.profiles
  add column if not exists avatar_url text default null;

-- Create avatars storage bucket (private — served via /api/avatar signed-URL proxy)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- RLS policies for avatars bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatar upload own'
  ) then
    execute $p$
      create policy "avatar upload own"
        on storage.objects for insert
        to authenticated
        with check (
          bucket_id = 'avatars'
          and (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatar update own'
  ) then
    execute $p$
      create policy "avatar update own"
        on storage.objects for update
        to authenticated
        using (
          bucket_id = 'avatars'
          and (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatar delete own'
  ) then
    execute $p$
      create policy "avatar delete own"
        on storage.objects for delete
        to authenticated
        using (
          bucket_id = 'avatars'
          and (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatar read authenticated'
  ) then
    execute $p$
      create policy "avatar read authenticated"
        on storage.objects for select
        to authenticated
        using (bucket_id = 'avatars')
    $p$;
  end if;
end
$$;
