-- F4: Public API keys + webhook endpoints + webhook_deliveries extensions
-- Idempotent backfill for repo parity (may already be applied on live Supabase).

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  key_hash text not null unique,
  key_prefix text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_user_id_idx on public.api_keys (user_id);
create index if not exists api_keys_org_scope_idx on public.api_keys (user_id, org_id);
create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);

alter table public.api_keys enable row level security;

drop policy if exists api_keys_select on public.api_keys;
drop policy if exists api_keys_insert on public.api_keys;
drop policy if exists api_keys_update on public.api_keys;
drop policy if exists api_keys_delete on public.api_keys;

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  secret text not null,
  description text,
  events text[] not null default '{}',
  enabled boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists webhook_endpoints_org_id_idx on public.webhook_endpoints (org_id);

alter table public.webhook_endpoints enable row level security;

drop policy if exists webhook_endpoints_select on public.webhook_endpoints;
drop policy if exists webhook_endpoints_insert on public.webhook_endpoints;
drop policy if exists webhook_endpoints_update on public.webhook_endpoints;
drop policy if exists webhook_endpoints_delete on public.webhook_endpoints;

alter table public.webhook_deliveries
  add column if not exists webhook_endpoint_id uuid references public.webhook_endpoints(id) on delete set null,
  add column if not exists event_type text,
  add column if not exists response_status integer,
  add column if not exists response_body text,
  add column if not exists error_message text;

alter table public.webhook_deliveries
  alter column timesheet_id drop not null;

create index if not exists webhook_deliveries_endpoint_id_idx
  on public.webhook_deliveries (webhook_endpoint_id)
  where webhook_endpoint_id is not null;
