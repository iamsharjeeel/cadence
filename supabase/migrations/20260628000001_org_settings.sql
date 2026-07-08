-- F1: org_settings table + RLS + get_or_create_org_settings RPC
-- (May already be applied on live Supabase — idempotent.)
--
-- NOTE: originally dated 20260616000001, but its policies and
-- get_or_create_org_settings() reference auth_workspace_role()/auth_org(),
-- which are first defined in 20260628000000_track_c2_atomic_cutover_rls_rewrite
-- (and depend on the memberships/active_workspace tables from track_c1/c2).
-- It was renumbered to 20260628000001 so a from-scratch replay
-- (`supabase db reset`, CI, disaster recovery) applies it AFTER those helpers
-- exist. Live prod already has it applied (under an MCP-managed name), so this
-- only affects fresh replays.

create table if not exists public.org_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade unique,
  tier text not null default 'business',
  approvals_timesheets boolean not null default false,
  approvals_leave boolean not null default false,
  approvals_expenses boolean not null default false,
  approver_scope text not null default 'owner_only'
    check (approver_scope in ('owner_only', 'owner_and_managers')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_settings_org_id_idx on public.org_settings (org_id);

create or replace function public.set_org_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists org_settings_updated_at on public.org_settings;
create trigger org_settings_updated_at
  before update on public.org_settings
  for each row execute function public.set_org_settings_updated_at();

alter table public.org_settings enable row level security;

drop policy if exists org_settings_select on public.org_settings;
create policy org_settings_select on public.org_settings
  for select to authenticated
  using (
    org_id = auth_org()
    and auth_workspace_role() = any (array['owner', 'admin']::user_role[])
  );

drop policy if exists org_settings_update on public.org_settings;
create policy org_settings_update on public.org_settings
  for update to authenticated
  using (
    org_id = auth_org()
    and auth_workspace_role() = 'owner'
  )
  with check (
    org_id = auth_org()
    and auth_workspace_role() = 'owner'
  );

drop policy if exists org_settings_insert on public.org_settings;
create policy org_settings_insert on public.org_settings
  for insert to authenticated
  with check (
    org_id = auth_org()
    and auth_workspace_role() = 'owner'
  );

-- Upsert default row; callable by owner or manager (admin) in active org.
create or replace function public.get_or_create_org_settings(p_org_id uuid)
returns public.org_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.org_settings;
begin
  if p_org_id is null then
    raise exception 'org_id required' using errcode = '22004';
  end if;

  if auth_org() is distinct from p_org_id then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if auth_workspace_role() not in ('owner', 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.org_settings (org_id)
  values (p_org_id)
  on conflict (org_id) do nothing;

  select * into v_row from public.org_settings where org_id = p_org_id;
  return v_row;
end;
$$;

revoke all on function public.get_or_create_org_settings(uuid) from public;
grant execute on function public.get_or_create_org_settings(uuid) to authenticated;
