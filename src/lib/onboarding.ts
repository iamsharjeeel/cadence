import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { redeemOrgInvites } from "@/lib/invites";
import type { Profile } from "@/types/db";

/**
 * Post-OAuth onboarding.
 *
 * Track C: every new user is a PERSONAL account by default. There is NO domain
 * auto-attach — a user only ever joins an org by accepting an invite addressed
 * to their email (redeemed here into `memberships`) or by creating one. New
 * users land **active** (no pending approval gate).
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

  // 2. Redeem any pending org invites for this email -> memberships.
  await redeemOrgInvites(userId, email);

  // 3. Activate immediately — no admin approval gate. Stays a personal account.
  if (profile.status === "pending") {
    const { data: refreshed } = await admin
      .from("profiles")
      .update({ status: "active" })
      .eq("id", userId)
      .eq("status", "pending")
      .select("*")
      .single();
    return refreshed ?? profile;
  }

  return profile;
}
