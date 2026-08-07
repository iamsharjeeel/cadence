-- Accept invite must not overwrite an existing membership role.
-- inviteMember already refuses invites to current members; this closes the
-- race / stale-invite path where ON CONFLICT DO UPDATE could escalate or demote.

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
  where id = p_invite_id
  for update;

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

  if exists (
    select 1 from public.memberships
    where user_id = v_uid and org_id = inv.org_id
  ) then
    update public.org_invites set accepted_at = now() where id = inv.id;
    return inv.org_id;
  end if;

  insert into public.memberships (user_id, org_id, role)
  values (v_uid, inv.org_id, inv.role);

  update public.org_invites set accepted_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;
