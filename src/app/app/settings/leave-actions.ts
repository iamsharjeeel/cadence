"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { applyDefaultBalancesForOrg } from "@/lib/leave/seed";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeaveCategory } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

export async function upsertLeaveType(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(["admin"]);
  if (!admin.org_id) return { ok: false, message: "No organization." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "") as LeaveCategory;
  const color = String(formData.get("color") ?? "#1F8A8A");
  const defaultDays = formData.get("default_days_per_year");
  const isActive = formData.get("is_active") === "on";

  if (!name) return { ok: false, message: "Name is required." };

  const db = createAdminClient();
  const payload = {
    org_id: admin.org_id,
    name,
    category,
    color,
    default_days_per_year: defaultDays ? Number(defaultDays) : null,
    is_active: isActive,
  };

  if (id) {
    const { error } = await db
      .from("leave_types")
      .update(payload)
      .eq("id", id)
      .eq("org_id", admin.org_id);
    if (error) return { ok: false, message: "Couldn't update leave type." };
  } else {
    const { error } = await db.from("leave_types").insert(payload);
    if (error) return { ok: false, message: "Couldn't create leave type." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/leave");
  return { ok: true, message: id ? "Leave type updated." : "Leave type created." };
}

export async function applyDefaultsToAll(
  year: number,
): Promise<ActionResult> {
  const admin = await requireRole(["admin"]);
  if (!admin.org_id) return { ok: false, message: "No organization." };
  const count = await applyDefaultBalancesForOrg(admin.org_id, year);
  revalidatePath("/app/leave");
  return { ok: true, message: `Applied defaults to ${count} balance records.` };
}
