"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import {
  slugify,
  validateCurrency,
  validateDomains,
  validateOrgName,
  validateSlug,
} from "@/lib/validation";
import type { PeriodCadence } from "@/types/db";
import { PERIOD_CADENCES } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

/**
 * Creates an organization. Superadmin only — re-checked here, not just in UI.
 * Validates name, slug (format + uniqueness), currency, cadence, and domains
 * server-side. Writes an `org.create` audit entry.
 */
export async function createOrg(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireRole(["superadmin"]);

  const name = validateOrgName(String(formData.get("name") ?? ""));
  if (!name.ok) return { ok: false, message: name.error };

  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = validateSlug(rawSlug || slugify(name.value));
  if (!slug.ok) return { ok: false, message: slug.error };

  const currency = validateCurrency(
    String(formData.get("base_currency") ?? "USD"),
  );
  if (!currency.ok) return { ok: false, message: currency.error };

  const cadence = String(
    formData.get("default_cadence") ?? "monthly",
  ) as PeriodCadence;
  if (!PERIOD_CADENCES.includes(cadence))
    return { ok: false, message: "Invalid cadence." };

  const domains = validateDomains(String(formData.get("allowed_domains") ?? ""));
  if (!domains.ok) return { ok: false, message: domains.error };

  const db = createAdminClient();

  // Enforce slug uniqueness explicitly for a friendly error (DB also enforces).
  const { data: existing } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug.value)
    .maybeSingle();
  if (existing) return { ok: false, message: "That slug is already taken." };

  const { data: org, error } = await db
    .from("organizations")
    .insert({
      name: name.value,
      slug: slug.value,
      base_currency: currency.value,
      default_cadence: cadence,
      allowed_domains: domains.value,
    })
    .select("id")
    .single();

  if (error || !org) {
    const message = error?.message.includes("duplicate")
      ? "That slug is already taken."
      : "Couldn't create organization.";
    return { ok: false, message };
  }

  await writeAudit({
    actorId: actor.id,
    orgId: org.id,
    action: "org.create",
    entity: org.id,
    payload: {
      name: name.value,
      slug: slug.value,
      base_currency: currency.value,
      default_cadence: cadence,
      allowed_domains: domains.value,
    },
  });

  revalidatePath("/app/organizations");
  return { ok: true, message: `${name.value} created.` };
}
