-- ---------------------------------------------------------------------------
-- Cadence — bootstrap the first superadmin.
--
-- RUN THIS ONCE, AFTER the intended superadmin has signed in with Google at
-- least once (the signup trigger must have created their `profiles` row first).
--
-- This is an alternative to setting the SUPERADMIN_EMAIL env var, which
-- promotes that email automatically on sign-in. Use whichever you prefer.
--
-- Replace the email below, then run in the Supabase SQL editor.
-- ---------------------------------------------------------------------------

update public.profiles
set role = 'superadmin',
    status = 'active'
where email = 'you@example.com';

-- Verify:
-- select id, email, role, status from public.profiles where role = 'superadmin';
