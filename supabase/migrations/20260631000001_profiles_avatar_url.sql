-- Avatar URL on profiles (preset path or private storage key).
alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public preset path (/avatars/preset-N.svg) or private avatars bucket object key.';

-- Re-apply column grants so authenticated users can self-update avatar_url (C1 pattern).
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'profiles'
    AND column_name NOT IN ('role', 'status', 'org_id');

  EXECUTE 'REVOKE UPDATE ON public.profiles FROM authenticated';
  EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', cols);
END
$$;
