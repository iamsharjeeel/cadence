import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { emailDomain } from "@/lib/utils";
import type { Profile } from "@/types/db";

/**
 * Post-OAuth onboarding: domain-gating + superadmin backstop.
 *
 * Runs in the `/auth/callback` route with the service-role client (the user is
 * `pending` with no org, so RLS would otherwise block these writes).
 *
 * Rules:
 *   1. SUPERADMIN_EMAIL backstop — if the signed-in email matches the
 *      server-only `SUPERADMIN_EMAIL`, promote to superadmin + active so the
 *      platform is never locked out. (Alternative to the seed SQL.)
 *   2. Domain-gating — if the profile has no org, match the email domain
 *      against every org's `allowed_domains`. Exactly one match → attach
 *      `org_id` (status stays `pending`, awaiting admin approval). Zero or
 *      multiple matches → leave org null (superadmin resolves manually).
 *
 * Returns the up-to-date profile so the caller can route by role/status.
 */
export async function runOnboarding(
  userId: string,
  email: string,
): Promise<Profile | null> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  // 1. Superadmin backstop — only promote pending profiles; never demote active users.
  const superadminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  if (
    superadminEmail &&
    email.toLowerCase() === superadminEmail &&
    profile.status === "pending"
  ) {
    const { data: promoted } = await admin
      .from("profiles")
      .update({ role: "superadmin", status: "active" })
      .eq("id", userId)
      .eq("status", "pending")
      .select("*")
      .single();
    return promoted ?? profile;
  }

  // 2. Domain-gating — only when the profile has no org yet.
  if (!profile.org_id) {
    const domain = emailDomain(email);
    if (domain) {
      const { data: orgs } = await admin
        .from("organizations")
        .select("id, allowed_domains")
        .contains("allowed_domains", [domain]);

      // Exactly one org claims this domain → attach it.
      if (orgs && orgs.length === 1) {
        const { data: attached } = await admin
          .from("profiles")
          .update({ org_id: orgs[0].id })
          .eq("id", userId)
          .select("*")
          .single();
        return attached ?? profile;
      }
    }
  }

  return profile;
}
