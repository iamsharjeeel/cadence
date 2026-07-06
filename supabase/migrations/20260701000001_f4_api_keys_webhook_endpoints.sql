-- F4: Public API keys + webhook endpoints + webhook_deliveries extensions
-- Idempotent backfill aligned to live Supabase (migrations api_keys / webhook_endpoints).

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

alter table public.api_keys enable row level security;

drop policy if exists api_keys_select_own on public.api_keys;
create policy api_keys_select_own on public.api_keys
  for select using (user_id = auth.uid());

drop policy if exists api_keys_insert_own on public.api_keys;
create policy api_keys_insert_own on public.api_keys
  for insert with check (user_id = auth.uid());

drop policy if exists api_keys_update_own on public.api_keys;
create policy api_keys_update_own on public.api_keys
  for update using (user_id = auth.uid());

drop policy if exists api_keys_delete_own on public.api_keys;
create policy api_keys_delete_own on public.api_keys
  for delete using (user_id = auth.uid());

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  secret text not null,
  description text,
  events text[] not null default '{}',
  enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.webhook_endpoints enable row level security;

drop policy if exists webhook_endpoints_owner_admin on public.webhook_endpoints;
create policy webhook_endpoints_owner_admin on public.webhook_endpoints
  for all using (
    exists (
      select 1 from public.memberships m
      where m.org_id = webhook_endpoints.org_id
        and m.user_id = auth.uid()
        and m.role = any (array['owner'::public.user_role, 'admin'::public.user_role])
    )
  );

alter table public.webhook_deliveries
  add column if not exists webhook_endpoint_id uuid references public.webhook_endpoints(id) on delete set null,
  add column if not exists event_type text,
  add column if not exists response_status integer,
  add column if not exists response_body text,
  add column if not exists error_message text;

alter table public.webhook_deliveries
  alter column timesheet_id drop not null;
