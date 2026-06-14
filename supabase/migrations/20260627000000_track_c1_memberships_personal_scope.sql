-- =====================================================================
-- Track C1 — Multi-workspace data model foundation
-- (memberships table + personal-data scope + self-serve org creation)
-- =====================================================================
-- Part of Track C: convert Cadence from single-org-per-user to TRUE
-- multi-workspace (personal-by-default + many-to-many org memberships +
-- workspace switcher). This migration is STAGE C1 only.
--
-- C1 SCOPE (this migration) — ADDITIVE / NON-DESTRUCTIVE ONLY:
--   1. New `memberships` table: many-to-many user <-> org with a role.
--      A solo user has zero rows; a user may belong to many orgs.
--      RLS: a user reads ONLY their own memberships (+ superadmin oversight
--      read). There is intentionally NO client write path — all writes go
--      through SECURITY DEFINER RPCs / the service role, so nothing can
--      self-grant a membership into an existing org (full admin-authorized
--      write paths are designed in C2/C4).
--   2. Personal-data scope = option (a): org_id IS NULL means "personal",
--      with personal rows owned via employee_id / user_id / owner_id =
--      auth.uid(). Chosen over a synthetic per-user "personal org" because
--      the task framing is explicit that personal data belongs to the USER,
--      not an org; the live schema already treats org_id as nullable on
--      profiles + audit_log; and it avoids polluting `organizations` with N
--      personal rows + FK churn. Implemented here by widening org_id to
--      NULLABLE on the personal-capable tenant tables. EXISTING ROWS ARE
--      UNCHANGED — only the NOT NULL constraint is relaxed so personal rows
--      can exist from C3 onward.
--   3. `create_organization()` SECURITY DEFINER RPC: lets any active user
--      self-create an org and become its OWNER (atomic org + owner
--      membership). Fully self-serve (no superadmin). Dormant until wired to
--      the UI in C3.
--
-- DELIBERATELY NOT DONE IN C1 (deferred to C2 per the brief — "Keep
-- auth_org()/auth_role() UNTOUCHED in C1 ... Do not half-break the live
-- helpers. Full rewrite is C2."). NOTE: this Supabase project is shared by
-- prod and preview deploys (there is no separate branch DB), so anything
-- that changed live data/helpers now would break the running prod app for
-- the existing beta users:
--   * auth_org() / auth_role() / is_active() are LEFT UNTOUCHED.
--   * No existing row's org_id is changed (the org->personal data cutover and
--     the RLS rewrite happen atomically in C2, with the isolation battery).
--   * No existing policy is changed; the C1/C2/H1 security fixes are preserved.
--   * Superadmin (the owner) is left exactly as-is (role + everything).
--
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1. memberships -------------------------------------------------------
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id)      on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  role       public.user_role not null default 'employee',
  created_at timestamptz not null default now(),
  constraint memberships_role_check check (role in ('owner','admin','employee')),
  constraint memberships_user_org_unique unique (user_id, org_id)
);

create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists memberships_org_id_idx  on public.memberships(org_id);

alter table public.memberships enable row level security;

-- Grants: authenticated may only SELECT (RLS-filtered); never write directly.
-- (SECURITY DEFINER RPCs run as the table owner and bypass these grants/RLS.)
revoke all on public.memberships from anon;
revoke all on public.memberships from authenticated;
grant select on public.memberships to authenticated;

-- RLS: a user reads only their OWN memberships.
drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own on public.memberships
  for select to authenticated
  using (user_id = auth.uid());

-- RLS: superadmin oversight read (cross-tenant, platform layer — not a member).
drop policy if exists memberships_select_superadmin on public.memberships;
create policy memberships_select_superadmin on public.memberships
  for select to authenticated
  using (public.auth_role() = 'superadmin');

-- (No INSERT / UPDATE / DELETE policies: writes are service-role / SECURITY
--  DEFINER only. This is the C1 "no client write path that could self-grant".)

-- 2. Personal-data scope ----------------------------------------------
-- Widen org_id to NULLABLE on personal-capable tables so personal
-- (org_id IS NULL) rows can exist. Existing rows keep their org_id.
-- (webhook_deliveries + org_invites stay org-only / NOT NULL;
--  audit_log + profiles are already nullable.)
alter table public.time_entries       alter column org_id drop not null;
alter table public.projects           alter column org_id drop not null;
alter table public.timesheets         alter column org_id drop not null;
alter table public.timesheet_rows     alter column org_id drop not null;
alter table public.documents          alter column org_id drop not null;
alter table public.leave_types        alter column org_id drop not null;
alter table public.leave_balances     alter column org_id drop not null;
alter table public.leave_requests     alter column org_id drop not null;
alter table public.official_documents alter column org_id drop not null;
alter table public.onboarding_steps   alter column org_id drop not null;
alter table public.notifications      alter column org_id drop not null;

-- 3. Self-serve org creation RPC (dormant until C3) -------------------
-- Any active user can create an org and atomically become its OWNER.
-- This is the ONLY authorized way (besides service role) to mint a
-- membership in C1, and it can only ever make the caller owner of a NEW
-- org — it cannot grant membership into an existing org.
create or replace function public.create_organization(
  p_name          text,
  p_slug          text default null,
  p_base_currency text default 'USD',
  p_cadence       public.period_cadence default 'monthly'
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_slug text;
  v_org  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = v_uid and status = 'active') then
    raise exception 'only an active account can create an organization' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'organization name is required' using errcode = '22000';
  end if;

  -- derive a url-safe, unique slug
  v_slug := lower(regexp_replace(coalesce(nullif(btrim(p_slug), ''), p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := btrim(v_slug, '-');
  if v_slug = '' then v_slug := 'org'; end if;
  if exists (select 1 from organizations where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into organizations (name, slug, base_currency, default_cadence, allowed_domains)
  values (
    btrim(p_name),
    v_slug,
    coalesce(nullif(btrim(p_base_currency), ''), 'USD'),
    coalesce(p_cadence, 'monthly'),
    '{}'
  )
  returning id into v_org;

  insert into public.memberships (user_id, org_id, role)
  values (v_uid, v_org, 'owner');

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, public.period_cadence) from public, anon;
grant execute on function public.create_organization(text, text, text, public.period_cadence) to authenticated;
