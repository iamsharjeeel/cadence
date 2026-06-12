"use server";

import { isRedirectError } from "next/dist/client/components/redirect";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import {
  validateCurrency,
  validateDomains,
  validateOrgName,
} from "@/lib/validation";
import { normalizeAllowedDomains } from "@/lib/org-utils";
import type { PeriodCadence } from "@/types/db";
import { PERIOD_CADENCES } from "@/types/db";

export type ActionResult = { ok: boolean; message: string; logoUrl?: string };

async function resolveOrgId(
  admin: Awaited<ReturnType<typeof requireRole>>,
  formOrgId?: string,
): Promise<{ orgId: string | null; error?: string }> {
  if (admin.role === "admin") {
    if (!admin.org_id) return { orgId: null, error: "Your account has no organization." };
    return { orgId: admin.org_id };
  }
  const orgId = formOrgId?.trim();
  if (!orgId) return { orgId: null, error: "Select an organization." };
  return { orgId };
}

export async function updateOrgDetails(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(["admin", "superadmin"]);
  const { orgId, error: orgErr } = await resolveOrgId(
    admin,
    String(formData.get("org_id") ?? ""),
  );
  if (!orgId) return { ok: false, message: orgErr! };

  const name = validateOrgName(String(formData.get("name") ?? ""));
  if (!name.ok) return { ok: false, message: name.error };

  const currency = validateCurrency(String(formData.get("base_currency") ?? ""));
  if (!currency.ok) return { ok: false, message: currency.error };

  const cadence = String(formData.get("default_cadence") ?? "monthly") as PeriodCadence;
  if (!PERIOD_CADENCES.includes(cadence))
    return { ok: false, message: "Invalid cadence." };

  const db = createAdminClient();
  const { error } = await db
    .from("organizations")
    .update({
      name: name.value,
      base_currency: currency.value,
      default_cadence: cadence,
    })
    .eq("id", orgId);

  if (error) return { ok: false, message: "Couldn't save organization details." };

  await writeAudit({
    actorId: admin.id,
    orgId,
    action: "org_settings_updated",
    entity: orgId,
    payload: { section: "details", name: name.value, base_currency: currency.value, default_cadence: cadence },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true, message: "Organization details saved." };
}

export async function updateOrgDomains(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(["admin", "superadmin"]);
  const { orgId, error: orgErr } = await resolveOrgId(
    admin,
    String(formData.get("org_id") ?? ""),
  );
  if (!orgId) return { ok: false, message: orgErr! };

  const domains = validateDomains(String(formData.get("allowed_domains") ?? ""));
  if (!domains.ok) return { ok: false, message: domains.error };

  const db = createAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("allowed_domains")
    .eq("id", orgId)
    .single();

  const removed = normalizeAllowedDomains(org?.allowed_domains).filter(
    (d) => !domains.value.includes(d),
  );

  if (removed.length > 0) {
    const { data: activeEmployees } = await db
      .from("profiles")
      .select("email")
      .eq("org_id", orgId)
      .eq("status", "active")
      .eq("role", "employee");

    for (const emp of activeEmployees ?? []) {
      const domain = emp.email.split("@")[1]?.toLowerCase();
      if (domain && removed.includes(domain)) {
        return {
          ok: false,
          message: `Cannot remove ${domain} — active employees use this domain.`,
        };
      }
    }
  }

  const { error } = await db
    .from("organizations")
    .update({ allowed_domains: domains.value })
    .eq("id", orgId);

  if (error) return { ok: false, message: "Couldn't save domains." };

  await writeAudit({
    actorId: admin.id,
    orgId,
    action: "org_settings_updated",
    entity: orgId,
    payload: { section: "domains", allowed_domains: domains.value },
  });

  revalidatePath("/app/settings");
  return { ok: true, message: "Allowed domains saved." };
}

export async function uploadOrgLogo(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(["admin", "superadmin"]);
  const { orgId, error: orgErr } = await resolveOrgId(
    admin,
    String(formData.get("org_id") ?? ""),
  );
  if (!orgId) return { ok: false, message: orgErr! };

  const raw = formData.get("logo");
  if (!(raw instanceof File) || raw.size === 0) {
    return {
      ok: false,
      message:
        "Choose an image to upload. If you already selected one, try again — the upload form must use multipart encoding.",
    };
  }
  const file = raw;

  if (file.size > 2 * 1024 * 1024)
    return { ok: false, message: "Logo must be under 2MB." };

  const ext = file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
  if (
    !["image/png", "image/jpeg", "image/jpg"].includes(file.type) &&
    file.type !== ""
  ) {
    return { ok: false, message: "Only PNG or JPG images are allowed." };
  }

  try {
    const path = `${orgId}/${Date.now()}.${ext}`;
    const db = createAdminClient();
    const bytes = new Uint8Array(await file.arrayBuffer());

    console.info("[uploadOrgLogo] uploading", {
      orgId,
      path,
      size: bytes.byteLength,
      contentType: file.type || `image/${ext}`,
    });

    const { error: upErr } = await db.storage.from("org-logos").upload(path, bytes, {
      contentType: file.type || `image/${ext}`,
      upsert: true,
    });

    if (upErr) {
      console.error("[uploadOrgLogo] storage upload failed:", JSON.stringify(upErr));
      const hint =
        upErr.message?.includes("Bucket not found") ||
        upErr.message?.includes("not found")
          ? " The org-logos storage bucket may be missing — run the Phase 6 migration in Supabase."
          : "";
      return {
        ok: false,
        message: `Couldn't upload logo.${hint} ${upErr.message ?? ""}`.trim(),
      };
    }

    const {
      data: { publicUrl: logoUrl },
    } = db.storage.from("org-logos").getPublicUrl(path);

    const { error } = await db
      .from("organizations")
      .update({ logo_url: logoUrl })
      .eq("id", orgId);

    if (error) {
      console.error("[uploadOrgLogo] DB update failed:", JSON.stringify(error));
      await db.storage.from("org-logos").remove([path]);
      return { ok: false, message: "Couldn't save logo URL." };
    }

    await writeAudit({
      actorId: admin.id,
      orgId,
      action: "org_settings_updated",
      entity: orgId,
      payload: { section: "logo", logo_url: logoUrl },
    });

    revalidatePath("/app/settings");
    revalidatePath("/app");
    revalidatePath("/app/dashboard");
    revalidatePath("/app/organizations");
    return { ok: true, message: "Logo uploaded.", logoUrl };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    console.error("[uploadOrgLogo] unexpected error:", e);
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Couldn't upload logo. Please try again.",
    };
  }
}

/** Admin only — suspends all non-admin employees in the org. */
export async function suspendAllEmployees(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(["admin"]);
  if (!admin.org_id) return { ok: false, message: "Your account has no organization." };

  const confirmed = formData.get("confirm") === "yes";
  if (!confirmed) return { ok: false, message: "Confirmation required." };

  const db = createAdminClient();
  const { data, error } = await db
    .from("profiles")
    .update({ status: "suspended" })
    .eq("org_id", admin.org_id)
    .eq("role", "employee")
    .eq("status", "active")
    .select("id");

  if (error) return { ok: false, message: "Couldn't suspend employees." };

  await writeAudit({
    actorId: admin.id,
    orgId: admin.org_id,
    action: "org_settings_updated",
    entity: admin.org_id,
    payload: { section: "danger_zone", action: "suspend_all_employees", count: data?.length ?? 0 },
  });

  revalidatePath("/app/employees");
  revalidatePath("/app/settings");
  return {
    ok: true,
    message: `Suspended ${data?.length ?? 0} employee(s).`,
  };
}

/** @deprecated Use section-specific actions instead. Kept for compatibility. */
export async function updateOwnOrg(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return updateOrgDetails(_prev, formData);
}
