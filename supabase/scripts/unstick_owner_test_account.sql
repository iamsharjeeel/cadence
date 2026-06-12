-- ---------------------------------------------------------------------------
-- Cadence — unstick owner's test account (invite / membership cleanup)
--
-- SET test_email below, run SELECT blocks first, then DELETE/UPDATE.
-- Does NOT delete auth.users or profiles — clears org membership + invites only.
-- ---------------------------------------------------------------------------

-- >>> Replace with stuck test email <<<
-- Common owner test addresses: iamsharjeeel@gmail.com, iamsharjeeel+1@gmail.com

-- 1) PREVIEW — profile membership
SELECT id, email, org_id, role, status, full_name, created_at
FROM profiles
WHERE lower(email) = lower('iamsharjeeel@gmail.com');

-- 2) PREVIEW — pending / stale org invites
SELECT id, org_id, email, role, invited_by, created_at, expires_at, accepted_at
FROM org_invites
WHERE lower(email) = lower('iamsharjeeel@gmail.com');

-- 3) PREVIEW — auth user (informational; delete only if re-signup still blocked)
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE lower(email) = lower('iamsharjeeel@gmail.com');

-- ---------------------------------------------------------------------------
-- CLEANUP (run after reviewing SELECT results)
-- ---------------------------------------------------------------------------

DELETE FROM org_invites
WHERE lower(email) = lower('iamsharjeeel@gmail.com')
  AND accepted_at IS NULL;

UPDATE profiles
SET org_id = NULL,
    role = 'employee',
    status = 'active'
WHERE lower(email) = lower('iamsharjeeel@gmail.com')
  AND role <> 'superadmin';

-- Verify
SELECT id, email, org_id, role, status FROM profiles
WHERE lower(email) = lower('iamsharjeeel@gmail.com');

SELECT count(*) AS remaining_pending_invites
FROM org_invites
WHERE lower(email) = lower('iamsharjeeel@gmail.com') AND accepted_at IS NULL;
