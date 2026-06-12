import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/db";

export type OrgInvite = {
  id: string;
  org_id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

/** Apply a pending invite for this email, if one exists. Returns updated profile fields. */
export async function redeemOrgInvite(
  userId: string,
  email: string,
): Promise<{ org_id: string; role: UserRole } | null> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();

  const { data: invite } = await admin
    .from("org_invites")
    .select("id, org_id, role, expires_at")
    .ilike("email", normalized)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invite) return null;

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      org_id: invite.org_id,
      role: invite.role as UserRole,
      status: "active",
    })
    .eq("id", userId);

  if (profileErr) {
    console.error("[invite] profile update failed:", profileErr.message);
    return null;
  }

  await admin
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return { org_id: invite.org_id, role: invite.role as UserRole };
}

export async function getOrgName(orgId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();
  return data?.name ?? "your organization";
}
