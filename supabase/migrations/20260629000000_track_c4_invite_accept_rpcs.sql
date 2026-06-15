-- =====================================================================
-- Track C4 — invite acceptance (org_invites -> memberships)
-- =====================================================================
-- Invite-only org joining for the multi-workspace model. Invites are still
-- authored on org_invites by an org owner/admin (employees page). Acceptance
-- now mints a MEMBERSHIP (not a profiles.org_id attach). Two SECURITY DEFINER
-- helpers let an invitee see + accept invites addressed to their own email
-- WITHOUT widening the manager-only org_invites read policy:
--   * pending_invites_for_me() — invites addressed to the caller's email.
--   * accept_invite(invite_id)  — accept ONE such invite -> membership.
--
-- Safety: accept_invite only ever creates a membership for the CALLER, only
-- into the org of an invite addressed to the CALLER's email, and only while
-- that invite is unaccepted + unexpired. Combined with create_organization
-- (owner of a NEW org), these remain the only two membership-write paths — a
-- user still cannot self-grant into an arbitrary existing org. No tenant RLS
-- policy is changed by this migration. Idempotent.
-- =====================================================================

create or replace function public.pending_invites_for_me()
returns table (id uuid, org_id uuid, org_name text, role public.user_role, expires_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select i.id, i.org_id, o.name, i.role, i.expires_at
  from public.org_invites i
  join public.organizations o on o.id = i.org_id
  where i.accepted_at is null
    and i.expires_at > now()
    and lower(i.email) = lower((select email from public.profiles where id = auth.uid()));
$$;
revoke all on function public.pending_invites_for_me() from anon;
grant execute on function public.pending_invites_for_me() to authenticated;

create or replace function public.accept_invite(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  inv     record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select lower(email) into v_email from public.profiles where id = v_uid;

  select id, org_id, email, role, expires_at, accepted_at
    into inv
  from public.org_invites
  where id = p_invite_id;

  if inv.id is null then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  if lower(inv.email) is distinct from v_email then
    raise exception 'invite is not addressed to this account' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite already accepted' using errcode = '22000';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invite has expired' using errcode = '22000';
  end if;

  insert into public.memberships (user_id, org_id, role)
  values (v_uid, inv.org_id, inv.role)
  on conflict (user_id, org_id) do update set role = excluded.role;

  update public.org_invites set accepted_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;
revoke all on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;
