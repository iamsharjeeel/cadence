#!/usr/bin/env node
/**
 * Run with service-role env vars:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/unstick-test-account.mjs <email>
 */
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? process.env.TEST_EMAIL ?? "").trim().toLowerCase();
if (!email) {
  console.error(
    "Usage: node scripts/unstick-test-account.mjs <email>  (or set TEST_EMAIL)",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

console.log(`\n=== Preview for ${email} ===\n`);

const { data: profiles } = await db
  .from("profiles")
  .select("id, email, org_id, role, status, full_name")
  .ilike("email", email);
console.log("profiles:", profiles);

const { data: invites } = await db
  .from("org_invites")
  .select("id, org_id, email, role, accepted_at, expires_at")
  .ilike("email", email);
console.log("org_invites:", invites);

const { error: inviteDelErr, count: inviteCount } = await db
  .from("org_invites")
  .delete({ count: "exact" })
  .ilike("email", email)
  .is("accepted_at", null);

if (inviteDelErr) {
  console.error("org_invites delete failed:", inviteDelErr.message);
  process.exit(1);
}
console.log(`\nDeleted ${inviteCount ?? 0} pending invite(s).`);

const { error: profileErr, data: updated } = await db
  .from("profiles")
  .update({ org_id: null, role: "employee", status: "active" })
  .ilike("email", email)
  .neq("role", "superadmin")
  .select("id, email, org_id, role, status");

if (profileErr) {
  console.error("profiles update failed:", profileErr.message);
  process.exit(1);
}

console.log("Updated profiles:", updated);
console.log("\nDone — account should be re-invitable or able to fresh-signup.\n");
