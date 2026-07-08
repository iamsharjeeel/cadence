"use server";

import { revalidatePath } from "next/cache";

import { getWorkspaceContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { bankingToDbPayload, parseBankingFormData } from "@/lib/banking";
import { validateCurrency, validateRate } from "@/lib/validation";
import type { Profile, RateType, UserRole, UserStatus } from "@/types/db";
import { RATE_TYPES } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

// Neither admin nor superadmin may assign the superadmin role from this screen.
const ASSIGNABLE_ROLES: UserRole[] = ["owner", "admin", "employee"];
const ASSIGNABLE_STATUSES: UserStatus[] = ["active", "suspended", "pending"];

/**
 * Track C: asserts the caller may act on a target. Authorization is keyed on
 * the ACTIVE workspace's membership, not the (now-vestigial) profiles.org_id:
 *   - superadmin: account-level oversight on any non-superadmin profile (orgId null)
 *   - org owner/admin: only on a MEMBER of the active org; managers can't touch owners
 * `target.role` is the member's role IN the active org (from memberships);
 * `orgId` is the active org (null for superadmin oversight).
 */
type AuthzOk = {
  ok: true;
  actor: Profile;
  target: Profile;
  orgId: string | null;
  callerRole: "owner" | "admin" | null;
  isSuperadmin: boolean;
};

async function authorizeTarget(
  targetId: string,
): Promise<AuthzOk | { ok: false; message: string }> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

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

  if (ctx.isSuperadmin) {
    return {
      ok: true,
      actor: ctx.realProfile,
      target: target as Profile,
      orgId: null,
      callerRole: null,
      isSuperadmin: true,
    };
  }

  const orgId = ctx.activeOrgId;
  const callerRole = ctx.workspaceRole;
  if (!orgId || (callerRole !== "owner" && callerRole !== "admin")) {
    return { ok: false, message: "Switch to an organization you own or manage." };
  }

  const { data: mem } = await db
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", targetId)
    .maybeSingle();

  if (!mem) return { ok: false, message: "That member isn't in this organization." };
  if (mem.role === "owner" && callerRole === "admin") {
    return { ok: false, message: "Managers can't modify owners." };
  }

  return {
    ok: true,
    actor: ctx.realProfile,
    target: { ...(target as Profile), role: mem.role as UserRole, org_id: orgId },
    orgId,
    callerRole,
    isSuperadmin: false,
  };
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
  if (!auth.orgId) {
    return {
      ok: false,
      message: "Roles are managed inside the organization — switch into it as an owner.",
    };
  }
  if (auth.target.id === auth.actor.id)
    return { ok: false, message: "You can't change your own role." };
  if (!ASSIGNABLE_ROLES.includes(role))
    return { ok: false, message: "Invalid role." };
  if (role === "owner") {
    return { ok: false, message: "Ownership isn't assigned from this control." };
  }
  if (auth.callerRole === "admin" && role !== "employee") {
    return { ok: false, message: "Managers can only assign the Employee role." };
  }
  if (role === auth.target.role) return { ok: true, message: "No change." };

  // Track C: role lives in memberships, not the vestigial profiles.role.
  const db = createAdminClient();
  const { error } = await db
    .from("memberships")
    .update({ role })
    .eq("org_id", auth.orgId)
    .eq("user_id", targetId);
  if (error) return { ok: false, message: "Couldn't update role." };

  await writeAudit({
    actorId: auth.actor.id,
    orgId: auth.orgId,
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
      source: "admin",
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
        tax_id: auth.target.tax_id,
        address: auth.target.address,
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
