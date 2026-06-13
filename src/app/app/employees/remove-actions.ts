"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { Profile } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

function canRemoveMember(actor: Profile, target: Profile): string | null {
  if (target.id === actor.id) {
    return "You can't remove yourself from the organization.";
  }
  if (target.role === "superadmin") {
    return "Superadmins can't be removed here.";
  }
  if (!actor.org_id || target.org_id !== actor.org_id) {
    return "That member isn't in your organization.";
  }
  if (actor.role === "admin") {
    if (target.role === "owner") {
      return "Managers can't remove owners.";
    }
    if (target.role === "admin") {
      return "Managers can only remove employees.";
    }
  }
  return null;
}

/**
 * Removes org membership only — clears profile.org_id and deletes pending invites.
 * Does NOT delete profiles or auth.users.
 */
export async function removeMemberFromOrg(
  targetId: string,
): Promise<ActionResult> {
  const actor = await requireRole(["admin", "owner", "superadmin"]);

  if (actor.role === "superadmin") {
    return {
      ok: false,
      message: "Use organization settings to manage members as superadmin.",
    };
  }

  if (!actor.org_id) {
    return { ok: false, message: "Your account has no organization." };
  }

  const db = createAdminClient();
  const { data: target } = await db
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .single();

  if (!target) return { ok: false, message: "Member not found." };

  const block = canRemoveMember(actor, target as Profile);
  if (block) return { ok: false, message: block };

  const email = (target.email ?? "").trim().toLowerCase();

  const { error: inviteErr } = await db
    .from("org_invites")
    .delete()
    .eq("org_id", actor.org_id)
    .ilike("email", email);

  if (inviteErr) {
    console.error("[remove] org_invites delete failed:", inviteErr.message);
    return { ok: false, message: "Couldn't clear pending invites." };
  }

  const { error: profileErr } = await db
    .from("profiles")
    .update({ org_id: null })
    .eq("id", targetId)
    .eq("org_id", actor.org_id);

  if (profileErr) {
    console.error("[remove] profile update failed:", profileErr.message);
    return { ok: false, message: "Couldn't remove member from organization." };
  }

  await writeAudit({
    actorId: actor.id,
    orgId: actor.org_id,
    action: "member_removed",
    entity: targetId,
    payload: {
      email,
      previous_role: target.role,
      previous_org_id: target.org_id,
    },
  });

  revalidatePath("/app/employees");
  return {
    ok: true,
    message: `${target.full_name?.trim() || email} removed from the organization.`,
  };
}

/** Cancel a pending invite (no profile yet, or profile not in org). */
export async function cancelOrgInvite(inviteId: string): Promise<ActionResult> {
  const actor = await requireRole(["admin", "owner"]);

  if (!actor.org_id) {
    return { ok: false, message: "Your account has no organization." };
  }

  const db = createAdminClient();
  const { data: invite } = await db
    .from("org_invites")
    .select("id, email, org_id, role")
    .eq("id", inviteId)
    .eq("org_id", actor.org_id)
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
    actorId: actor.id,
    orgId: actor.org_id,
    action: "member_invite_cancelled",
    entity: inviteId,
    payload: { email: invite.email, role: invite.role },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: `Invite to ${invite.email} cancelled.` };
}
