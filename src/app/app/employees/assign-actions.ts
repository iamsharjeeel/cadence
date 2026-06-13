"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, UserRole } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

const ASSIGNABLE_ROLES: UserRole[] = ["owner", "admin", "employee"];

/**
 * Superadmin assigns an unassigned user (org_id null) to an organization.
 */
export async function assignMemberToOrg(
  targetId: string,
  orgId: string,
  role: UserRole = "employee",
): Promise<ActionResult> {
  const actor = await requireRole(["superadmin"]);

  if (!orgId) return { ok: false, message: "Select an organization." };
  if (!ASSIGNABLE_ROLES.includes(role))
    return { ok: false, message: "Invalid role." };

  const db = createAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) return { ok: false, message: "Organization not found." };

  const { data: target } = await db
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .single();

  if (!target) return { ok: false, message: "Member not found." };
  if (target.role === "superadmin") {
    return { ok: false, message: "Superadmins can't be assigned to an org here." };
  }
  if (target.org_id) {
    return {
      ok: false,
      message: "This member already belongs to an organization.",
    };
  }

  const { error } = await db
    .from("profiles")
    .update({ org_id: orgId, role, status: "active" })
    .eq("id", targetId)
    .is("org_id", null);

  if (error) {
    console.error("[assign] profile update failed:", error.message);
    return { ok: false, message: "Couldn't assign member to organization." };
  }

  await writeAudit({
    actorId: actor.id,
    orgId,
    action: "member_assigned",
    entity: targetId,
    payload: {
      email: target.email,
      org_name: org.name,
      role,
    },
  });

  revalidatePath("/app/employees");
  return {
    ok: true,
    message: `${displayName(target as Profile)} assigned to ${org.name}.`,
  };
}

function displayName(p: Profile): string {
  return p.full_name?.trim() || p.email;
}
