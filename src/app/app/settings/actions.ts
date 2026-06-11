"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import {
  validateCurrency,
  validateDomains,
  validateOrgName,
} from "@/lib/validation";
import type { PeriodCadence } from "@/types/db";
import { PERIOD_CADENCES } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

/**
 * Updates the caller's OWN organization. Admin only, and the org id is taken
 * from the caller's profile — never from the form — so an admin can only ever
 * edit their own tenant. Slug is intentionally immutable here.
 */
export async function updateOwnOrg(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(["admin"]);
  if (!admin.org_id)
    return { ok: false, message: "Your account has no organization." };

  const name = validateOrgName(String(formData.get("name") ?? ""));
  if (!name.ok) return { ok: false, message: name.error };

  const currency = validateCurrency(
    String(formData.get("base_currency") ?? ""),
  );
  if (!currency.ok) return { ok: false, message: currency.error };

  const cadence = String(
    formData.get("default_cadence") ?? "monthly",
  ) as PeriodCadence;
  if (!PERIOD_CADENCES.includes(cadence))
    return { ok: false, message: "Invalid cadence." };

  const domains = validateDomains(String(formData.get("allowed_domains") ?? ""));
  if (!domains.ok) return { ok: false, message: domains.error };

  const logoRaw = String(formData.get("logo_url") ?? "").trim();
  if (logoRaw && !/^https:\/\/.+/i.test(logoRaw))
    return { ok: false, message: "Logo URL must start with https://" };

  const db = createAdminClient();
  const { error } = await db
    .from("organizations")
    .update({
      name: name.value,
      base_currency: currency.value,
      default_cadence: cadence,
      allowed_domains: domains.value,
      logo_url: logoRaw || null,
    })
    .eq("id", admin.org_id);

  if (error) return { ok: false, message: "Couldn't save settings." };

  await writeAudit({
    actorId: admin.id,
    orgId: admin.org_id,
    action: "org.update",
    entity: admin.org_id,
    payload: {
      name: name.value,
      base_currency: currency.value,
      default_cadence: cadence,
      allowed_domains: domains.value,
      logo_url: logoRaw || null,
    },
  });

  revalidatePath("/app/settings");
  return { ok: true, message: "Settings saved." };
}
