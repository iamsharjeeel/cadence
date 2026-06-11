"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { validateCurrency, validateRate } from "@/lib/validation";
import type { Profile, RateType, UserRole, UserStatus } from "@/types/db";
import { RATE_TYPES } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

// Admins may only assign these roles/statuses — never superadmin.
const ASSIGNABLE_ROLES: UserRole[] = ["admin", "employee"];
const ASSIGNABLE_STATUSES: UserStatus[] = ["active", "suspended", "pending"];

/**
 * Loads a target profile and asserts the caller (an admin) is allowed to act on
 * it: same org, target is not a superadmin. Returns both profiles or an error.
 *
 * This is the server-side authorization gate. RLS is a backstop; this is the
 * primary check. Employees never reach these actions (they lack the admin role).
 */
async function authorizeTarget(
  targetId: string,
): Promise<
  | { ok: true; admin: Profile; target: Profile }
  | { ok: false; message: string }
> {
  const admin = await requireRole(["admin"]);
  if (!admin.org_id) {
    return { ok: false, message: "Your account has no organization." };
  }

  const db = createAdminClient();
  const { data: target } = await db
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .single();

  if (!target) return { ok: false, message: "Member not found." };
  if (target.org_id !== admin.org_id) {
    return { ok: false, message: "That member isn't in your organization." };
  }
  if (target.role === "superadmin") {
    return { ok: false, message: "Superadmins can't be modified here." };
  }
  return { ok: true, admin, target };
}

export async function approveMember(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const targetId = String(formData.get("id") ?? "");
  const auth = await authorizeTarget(targetId);
  if (!auth.ok) return { ok: false, message: auth.message };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ status: "active" })
    .eq("id", targetId);
  if (error) return { ok: false, message: "Couldn't approve member." };

  await writeAudit({
    actorId: auth.admin.id,
    orgId: auth.admin.org_id,
    action: "profile.approve",
    entity: targetId,
    payload: { from: auth.target.status, to: "active" },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: `${displayName(auth.target)} approved.` };
}

export async function setRole(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const targetId = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;

  const auth = await authorizeTarget(targetId);
  if (!auth.ok) return { ok: false, message: auth.message };
  if (auth.target.id === auth.admin.id)
    return { ok: false, message: "You can't change your own role." };
  if (!ASSIGNABLE_ROLES.includes(role))
    return { ok: false, message: "Invalid role." };
  if (role === auth.target.role)
    return { ok: true, message: "No change." };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ role })
    .eq("id", targetId);
  if (error) return { ok: false, message: "Couldn't update role." };

  await writeAudit({
    actorId: auth.admin.id,
    orgId: auth.admin.org_id,
    action: "profile.role_change",
    entity: targetId,
    payload: { from: auth.target.role, to: role },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: `Role updated to ${role}.` };
}

export async function setStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const targetId = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as UserStatus;

  const auth = await authorizeTarget(targetId);
  if (!auth.ok) return { ok: false, message: auth.message };
  if (auth.target.id === auth.admin.id)
    return { ok: false, message: "You can't change your own status." };
  if (!ASSIGNABLE_STATUSES.includes(status))
    return { ok: false, message: "Invalid status." };
  if (status === auth.target.status) return { ok: true, message: "No change." };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ status })
    .eq("id", targetId);
  if (error) return { ok: false, message: "Couldn't update status." };

  await writeAudit({
    actorId: auth.admin.id,
    orgId: auth.admin.org_id,
    action: "profile.status_change",
    entity: targetId,
    payload: { from: auth.target.status, to: status },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: `Status updated to ${status}.` };
}

export async function setRate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const targetId = String(formData.get("id") ?? "");
  const auth = await authorizeTarget(targetId);
  if (!auth.ok) return { ok: false, message: auth.message };

  const rate = validateRate(String(formData.get("rate") ?? ""));
  if (!rate.ok) return { ok: false, message: rate.error };

  const rateType = String(formData.get("rate_type") ?? "") as RateType;
  if (!RATE_TYPES.includes(rateType))
    return { ok: false, message: "Invalid rate type." };

  const currency = validateCurrency(String(formData.get("currency") ?? ""));
  if (!currency.ok) return { ok: false, message: currency.error };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      rate: rate.value,
      rate_type: rateType,
      currency: currency.value,
    })
    .eq("id", targetId);
  if (error) return { ok: false, message: "Couldn't update rate." };

  await writeAudit({
    actorId: auth.admin.id,
    orgId: auth.admin.org_id,
    action: "profile.rate_change",
    entity: targetId,
    payload: {
      from: {
        rate: auth.target.rate,
        rate_type: auth.target.rate_type,
        currency: auth.target.currency,
      },
      to: {
        rate: rate.value,
        rate_type: rateType,
        currency: currency.value,
      },
    },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: "Rate updated." };
}

function displayName(p: Profile): string {
  return p.full_name?.trim() || p.email;
}
