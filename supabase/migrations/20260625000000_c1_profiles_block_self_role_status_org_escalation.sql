-- =============================================================================
-- SECURITY FIX C1 (CRITICAL) — profiles privilege-escalation lockdown
-- =============================================================================
-- Finding (SECURITY_AUDIT.md -> C1): the live RLS policy "update own profile
-- basics" guards only WITH CHECK (id = auth.uid()), and the `authenticated`
-- role holds table-wide UPDATE on public.profiles (Supabase default GRANT ALL).
-- Postgres RLS cannot restrict *which columns* an UPDATE touches, so any logged
-- -in user could run, straight from the browser with the public anon key:
--     supabase.from('profiles').update({ role: 'superadmin' }).eq('id', myUid)
--     supabase.from('profiles').update({ org_id: '<other org>' }).eq('id', myUid)
-- and have it commit -- self-elevating to superadmin, or hopping into another
-- tenant by repointing org_id. Platform takeover / cross-tenant breach.
--
-- Fix (defense-in-depth, two independent layers):
--   (a) Privilege layer: drop the table-wide UPDATE grant from `authenticated`
--       and re-grant UPDATE on every column EXCEPT role/status/org_id. A
--       column-only REVOKE is INEFFECTIVE while the table-wide grant exists, so
--       the grant must be reset, not merely narrowed.
--   (b) Trigger layer: a SECURITY DEFINER BEFORE UPDATE trigger that rejects any
--       change to role/status/org_id unless the session is the service-role API
--       client (JWT role = 'service_role') or a direct privileged DB session
--       (no JWT context: migrations / dashboard / MCP).
--
-- Preserved on purpose:
--   * Users keep self-editing their OWN profile basics (full_name, banking,
--     rate, address, emergency contact, job_title, ...) via the authenticated
--     client -- those columns stay granted and the trigger ignores them.
--   * Admin/owner/superadmin changes to role/status/org_id for OTHER users keep
--     working: every such path uses the service-role client (createAdminClient
--     -> SUPABASE_SERVICE_ROLE_KEY) -- src/lib/onboarding.ts, src/lib/invites.ts,
--     src/app/app/employees/actions.ts, employees/assign-actions.ts,
--     employees/remove-actions.ts. service_role keeps full table+column UPDATE
--     and is allowed by the trigger.
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- (a) Column-privilege lockdown ----------------------------------------------
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

  -- Remove Supabase's default table-wide UPDATE, then re-grant per-column UPDATE
  -- on everything except the three privilege-escalation columns.
  EXECUTE 'REVOKE UPDATE ON public.profiles FROM authenticated';
  EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', cols);
END
$$;

-- (b) Trigger guard ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  jwt_role text;
BEGIN
  -- Role asserted by the validated JWT (set by PostgREST). The service-role API
  -- client presents 'service_role'; end users present 'authenticated'/'anon'.
  -- A direct privileged DB session (migration / dashboard / MCP) has no JWT.
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );

  IF jwt_role = 'service_role' OR jwt_role IS NULL THEN
    RETURN NEW;  -- trusted backend writer (service-role / direct DB)
  END IF;

  IF NEW.role   IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION
      'profiles: role, status and org_id are administrator-managed and cannot be changed by this account'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger-only function: it must never be reachable as a PostgREST RPC. A trigger
-- fires regardless of the invoker's EXECUTE privilege, so revoking EXECUTE from the
-- API roles is safe and keeps the function off the public/authenticated API surface.
REVOKE ALL ON FUNCTION public.guard_profiles_privileged_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profiles_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profiles_privileged_columns
  BEFORE UPDATE OF role, status, org_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_privileged_columns();
