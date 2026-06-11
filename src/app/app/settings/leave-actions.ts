"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { applyDefaultBalancesForOrg } from "@/lib/leave/seed";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateEnum,
  validateMaxLength,
  validateNonNegativeNumber,
  validateYear,
} from "@/lib/validation";
import type { LeaveCategory } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

const LEAVE_CATEGORIES = [
  "annual",
  "sick",
  "unpaid",
  "public_holiday",
  "custom",
] as const satisfies readonly LeaveCategory[];

function resolveOrgId(
  actor: { role: string; org_id: string | null },
  formData: FormData,
): string | null {
  if (actor.role === "superadmin") {
    const orgId = String(formData.get("org_id") ?? "").trim();
    return orgId || null;
  }
  return actor.org_id;
}

export async function upsertLeaveType(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(["admin", "superadmin"]);
  const orgId = resolveOrgId(admin, formData);
  if (!orgId) return { ok: false, message: "Select an organization." };

  const id = String(formData.get("id") ?? "");
  const nameV = validateMaxLength(String(formData.get("name") ?? ""), 80, "Name");
  if (!nameV.ok) return { ok: false, message: nameV.error };
  const name = nameV.value;

  const categoryV = validateEnum(
    String(formData.get("category") ?? ""),
    LEAVE_CATEGORIES,
    "category",
  );
  if (!categoryV.ok) return { ok: false, message: categoryV.error };
  const category = categoryV.value;

  const color = String(formData.get("color") ?? "#1F8A8A").trim();
  const defaultDaysRaw = formData.get("default_days_per_year");
  let defaultDaysPerYear: number | null = null;
  if (defaultDaysRaw) {
    const daysV = validateNonNegativeNumber(Number(defaultDaysRaw), "Default days");
    if (!daysV.ok) return { ok: false, message: daysV.error };
    defaultDaysPerYear = daysV.value;
  }
  const isActive = formData.get("is_active") === "on";

  const db = createAdminClient();
  const insertPayload = {
    org_id: orgId,
    name,
    category,
    color,
    default_days_per_year: defaultDaysPerYear,
    is_active: isActive,
  };

  if (id) {
    const { error } = await db
      .from("leave_types")
      .update({
        name,
        category,
        color,
        default_days_per_year: defaultDaysPerYear,
        is_active: isActive,
      })
      .eq("id", id)
      .eq("org_id", orgId);
    if (error) return { ok: false, message: "Couldn't update leave type." };
  } else {
    const { error } = await db.from("leave_types").insert(insertPayload);
    if (error) return { ok: false, message: "Couldn't create leave type." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/leave");
  return { ok: true, message: id ? "Leave type updated." : "Leave type created." };
}

export async function applyDefaultsToAll(
  year: number,
  orgId?: string,
): Promise<ActionResult> {
  const admin = await requireRole(["admin", "superadmin"]);
  const yearV = validateYear(year);
  if (!yearV.ok) return { ok: false, message: yearV.error };
  const targetOrgId =
    admin.role === "superadmin" ? orgId : admin.org_id ?? undefined;
  if (!targetOrgId) return { ok: false, message: "Select an organization." };
  const count = await applyDefaultBalancesForOrg(targetOrgId, yearV.value);
  revalidatePath("/app/leave");
  return { ok: true, message: `Applied defaults to ${count} balance records.` };
}
