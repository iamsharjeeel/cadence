"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext } from "@/lib/workspace";

export type ActionResult = { ok: boolean; message: string };

/**
 * Track C: removes a member from the caller's ACTIVE organization by deleting
 * the `memberships` row (and clearing their active_workspace + pending invites
 * for this org). The person's account + personal data are untouched.
 * Hierarchy: owner removes managers + employees; manager only employees;
 * nobody removes self / owners / superadmins.
 */
export async function removeMemberFromOrg(
  targetId: string,
): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };
  if (ctx.isSuperadmin) {
    return {
      ok: false,
      message: "Membership changes are made from within the organization.",
    };
  }

  const orgId = ctx.activeOrgId;
  const callerRole = ctx.workspaceRole;
  if (!orgId || (callerRole !== "owner" && callerRole !== "admin")) {
    return { ok: false, message: "Switch to an organization you own or manage." };
  }
  if (targetId === ctx.realProfile.id) {
    return { ok: false, message: "You can't remove yourself from the organization." };
  }

  const db = createAdminClient();
  const { data: mem } = await db
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", targetId)
    .maybeSingle();

  if (!mem) return { ok: false, message: "That person isn't a member of this organization." };
  const targetRole = mem.role as "owner" | "admin" | "employee";
  if (targetRole === "owner") {
    return { ok: false, message: "Owners can't be removed here." };
  }
  if (callerRole === "admin" && targetRole !== "employee") {
    return { ok: false, message: "Managers can only remove employees." };
  }

  const { data: target } = await db
    .from("profiles")
    .select("email, full_name")
    .eq("id", targetId)
    .maybeSingle();
  const email = (target?.email ?? "").trim().toLowerCase();

  const { error: memErr } = await db
    .from("memberships")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetId);
  if (memErr) {
    console.error("[remove] membership delete failed:", memErr.message);
    return { ok: false, message: "Couldn't remove member from organization." };
  }

  // If they were actively in this workspace, drop them back to personal.
  await db
    .from("active_workspace")
    .delete()
    .eq("user_id", targetId)
    .eq("org_id", orgId);

  if (email) {
    await db.from("org_invites").delete().eq("org_id", orgId).ilike("email", email);
  }

  await writeAudit({
    actorId: ctx.realProfile.id,
    orgId,
    action: "member_removed",
    entity: targetId,
    payload: { email, previous_role: targetRole },
  });

  revalidatePath("/app/employees");
  return {
    ok: true,
    message: `${target?.full_name?.trim() || email || "Member"} removed from the organization.`,
  };
}

/** Cancel a pending invite (no profile yet, or profile not in org). */
export async function cancelOrgInvite(inviteId: string): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const orgId = ctx.activeOrgId;
  const wsRole = ctx.workspaceRole;
  if (!orgId || (wsRole !== "owner" && wsRole !== "admin")) {
    return {
      ok: false,
      message: "Switch to an organization you own or manage.",
    };
  }

  const db = createAdminClient();
  const { data: invite } = await db
    .from("org_invites")
    .select("id, email, org_id, role")
    .eq("id", inviteId)
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .maybeSingle();

  if (!invite) {
    return { ok: false, message: "Invite not found or already accepted." };
  }

  const { error } = await db.from("org_invites").delete().eq("id", inviteId);

  if (error) {
    console.error("[remove] invite cancel failed:", error.message);
    return { ok: false, message: "Couldn't cancel invite." };
  }

  await writeAudit({
    actorId: ctx.realProfile.id,
    orgId,
    action: "member_invite_cancelled",
    entity: inviteId,
    payload: { email: invite.email, role: invite.role },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: `Invite to ${invite.email} cancelled.` };
}
