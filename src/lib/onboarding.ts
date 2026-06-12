import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { redeemOrgInvite } from "@/lib/invites";
import { emailDomain } from "@/lib/utils";
import type { Profile } from "@/types/db";

/**
 * Post-OAuth onboarding: invite redemption, domain-gating, superadmin backstop.
 * New users land **active** — no pending approval gate.
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

  // 2. Pending org invite — highest priority for org + role assignment.
  const redeemed = await redeemOrgInvite(userId, email);
  if (redeemed) {
    const { data: updated } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    return updated ?? profile;
  }

  const updates: Partial<Profile> = {};

  // 3. Domain-gating — attach org when exactly one org claims the email domain.
  if (!profile.org_id) {
    const domain = emailDomain(email);
    if (domain) {
      const { data: orgs } = await admin
        .from("organizations")
        .select("id, allowed_domains")
        .contains("allowed_domains", [domain]);

      if (orgs && orgs.length === 1) {
        updates.org_id = orgs[0].id;
        if (profile.role === "employee" || !profile.role) {
          updates.role = "employee";
        }
      }
    }
  }

  // 4. Activate immediately — no admin approval gate.
  if (profile.status === "pending") {
    updates.status = "active";
  }

  if (Object.keys(updates).length === 0) {
    return profile;
  }

  const { data: refreshed } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .single();

  return refreshed ?? profile;
}
