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

/**
 * Track C: redeem ALL pending invites addressed to this email into
 * `memberships` (the user stays a personal account by default; the org(s)
 * become available in the workspace switcher). Returns how many were redeemed.
 * Does NOT touch profiles.org_id — org membership is many-to-many now.
 */
export async function redeemOrgInvites(
  userId: string,
  email: string,
): Promise<number> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();

  const { data: invites } = await admin
    .from("org_invites")
    .select("id, org_id, role")
    .ilike("email", normalized)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());

  if (!invites || invites.length === 0) return 0;

  let redeemed = 0;
  for (const invite of invites) {
    const { error: memErr } = await (admin as any).from("memberships").upsert(
      {
        user_id: userId,
        org_id: invite.org_id,
        role: invite.role as UserRole,
      },
      { onConflict: "user_id,org_id" },
    );
    if (memErr) {
      console.error("[invite] membership upsert failed:", memErr.message);
      continue;
    }
    await admin
      .from("org_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    redeemed++;
  }

  return redeemed;
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
