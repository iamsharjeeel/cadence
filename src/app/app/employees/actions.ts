"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { bankingToDbPayload, parseBankingFormData } from "@/lib/banking";
import { roleLabel } from "@/lib/utils";
import { validateCurrency, validateRate } from "@/lib/validation";
import type { Profile, RateType, UserRole, UserStatus } from "@/types/db";
import { RATE_TYPES } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

// superadmin role is never assignable from this screen.
// 'owner' is assignable only by existing owners or superadmin (enforced in setRole).
const ASSIGNABLE_ROLES: UserRole[] = ["owner", "admin", "employee"];
const ASSIGNABLE_STATUSES: UserStatus[] = ["active", "suspended", "pending"];

/**
 * Loads a target profile and asserts the caller may act on it:
 *   - superadmin: may act on any profile in any org
 *   - admin:      may act only on profiles within their own org_id
 * In both cases the target may not itself be a superadmin.
 *
 * This is the server-side authorization gate (RLS is a backstop). Employees
 * never reach these actions — they lack the admin/superadmin role.
 */
async function authorizeTarget(
  targetId: string,
): Promise<
  | { ok: true; actor: Profile; target: Profile }
  | { ok: false; message: string }
> {
  const actor = await requireRole(["admin", "owner", "superadmin"]);

  const db = createAdminClient();
  const { data: target } = await db
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .single();

  if (!target) return { ok: false, message: "Member not found." };
  if (target.role === "superadmin") {
    return { ok: false, message: "Superadmins can't be modified here." };
  }

  // Org-scoped actors: owner and admin can only act within their own org.
  if (actor.role === "admin" || actor.role === "owner") {
    if (!actor.org_id || target.org_id !== actor.org_id) {
      return { ok: false, message: "That member isn't in your organization." };
    }
    // Admin (Manager) cannot modify owner profiles.
    if (actor.role === "admin" && target.role === "owner") {
      return { ok: false, message: "Managers cannot modify Owner profiles." };
    }
  }

  return { ok: true, actor, target };
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
    actorId: auth.actor.id,
    orgId: auth.target.org_id,
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
  if (auth.target.id === auth.actor.id)
    return { ok: false, message: "You can't change your own role." };
  if (!ASSIGNABLE_ROLES.includes(role))
    return { ok: false, message: "Invalid role." };
  // Only owners and superadmins may promote/assign the 'owner' role.
  if (role === "owner" && auth.actor.role === "admin") {
    return { ok: false, message: "Managers cannot assign the Owner role." };
  }
  if (role === auth.target.role) return { ok: true, message: "No change." };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ role })
    .eq("id", targetId);
  if (error) return { ok: false, message: "Couldn't update role." };

  await writeAudit({
    actorId: auth.actor.id,
    orgId: auth.target.org_id,
    action: "profile.role_change",
    entity: targetId,
    payload: { from: auth.target.role, to: role },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: `Role updated to ${roleLabel(role)}.` };
}

export async function setStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const targetId = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as UserStatus;

  const auth = await authorizeTarget(targetId);
  if (!auth.ok) return { ok: false, message: auth.message };
  if (auth.target.id === auth.actor.id)
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
    actorId: auth.actor.id,
    orgId: auth.target.org_id,
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
    actorId: auth.actor.id,
    orgId: auth.target.org_id,
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

export async function setEmployeeBanking(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const targetId = String(formData.get("id") ?? "");
  const auth = await authorizeTarget(targetId);
  if (!auth.ok) return { ok: false, message: auth.message };

  const input = parseBankingFormData(formData);
  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update(
      bankingToDbPayload(input, {
        bank_account_number: auth.target.bank_account_number,
        bank_bsb_swift: auth.target.bank_bsb_swift,
      }),
    )
    .eq("id", targetId);
  if (error) return { ok: false, message: "Couldn't save banking details." };

  revalidatePath("/app/employees");
  return { ok: true, message: "Banking details saved." };
}

function displayName(p: Profile): string {
  return p.full_name?.trim() || p.email;
}
