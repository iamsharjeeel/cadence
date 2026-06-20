"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireActiveProfile } from "@/lib/auth";
import { bankingToDbPayload, parseBankingFormData } from "@/lib/banking";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateIsoDate, validateMaxLength } from "@/lib/validation";
import { RATE_TYPES, type Profile, type RateType } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

const REQUIRED_STEPS = ["personal", "employment", "banking"] as const;
const NO_ORG_ERROR: ActionResult = { ok: false, message: "No organization." };

function isOnboardingPath(pathname: string): boolean {
  return (
    pathname.startsWith("/app/onboarding") || pathname.startsWith("/onboarding")
  );
}

function requestPathname(): string | null {
  const h = headers();
  const nextUrl = h.get("next-url");
  if (nextUrl) {
    try {
      return new URL(nextUrl).pathname;
    } catch {
      // fall through
    }
  }
  const referer = h.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).pathname;
  } catch {
    return null;
  }
}

/** Skips the no-org guard on `/app/onboarding` so personal-workspace users can finish setup. */
function requireOrg(profile: Profile): ActionResult | null {
  const pathname = requestPathname();
  if (pathname && isOnboardingPath(pathname)) return null;
  if (!profile.org_id) return NO_ORG_ERROR;
  return null;
}

async function markStep(
  profileId: string,
  orgId: string | null,
  step: string,
): Promise<void> {
  const db = createAdminClient();
  await db.from("onboarding_steps").upsert(
    {
      org_id: orgId,
      employee_id: profileId,
      step,
      completed_at: new Date().toISOString(),
    } as { org_id: string; employee_id: string; step: string; completed_at: string },
    { onConflict: "employee_id,step" },
  );
}

export async function savePersonal(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const orgError = requireOrg(profile);
  if (orgError) return orgError;

  const fullNameV = validateMaxLength(
    String(formData.get("full_name") ?? ""),
    120,
    "Name",
  );
  if (!fullNameV.ok) return { ok: false, message: fullNameV.error };
  const addressV = validateMaxLength(
    String(formData.get("address") ?? ""),
    500,
    "Address",
  );
  if (!addressV.ok) return { ok: false, message: addressV.error };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      full_name: fullNameV.value || profile.full_name,
      address: addressV.value || null,
    })
    .eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't save personal details." };

  await markStep(profile.id, profile.org_id ?? null, "personal");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function saveEmployment(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const orgError = requireOrg(profile);
  if (orgError) return orgError;

  // Every employment field is optional — the user may click through with
  // everything empty. Only values that were actually provided are validated;
  // start date is freely re-selectable (no lock once previously set).
  const jobTitleV = validateMaxLength(
    String(formData.get("job_title") ?? ""),
    80,
    "Job title",
  );
  if (!jobTitleV.ok) return { ok: false, message: jobTitleV.error };

  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  let startDate: string | null = null;
  if (startDateRaw) {
    const startV = validateIsoDate(startDateRaw, "Start date");
    if (!startV.ok) return { ok: false, message: startV.error };
    startDate = startV.value;
  }

  const rateRaw = String(formData.get("rate") ?? "").trim();
  let rate: number | null = null;
  if (rateRaw) {
    const parsed = Number(rateRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, message: "Enter a valid rate." };
    }
    rate = parsed;
  }

  const rateTypeRaw = String(formData.get("rate_type") ?? "").trim();
  let rateType: RateType | null = null;
  if (rateTypeRaw) {
    if (!RATE_TYPES.includes(rateTypeRaw as RateType)) {
      return { ok: false, message: "Invalid rate type." };
    }
    rateType = rateTypeRaw as RateType;
  }

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      job_title: jobTitleV.value || null,
      start_date: startDate,
      ...(rate !== null ? { rate } : {}),
      ...(rateType ? { rate_type: rateType } : {}),
    })
    .eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't save employment details." };

  await markStep(profile.id, profile.org_id ?? null, "employment");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function saveBanking(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const orgError = requireOrg(profile);
  if (orgError) return orgError;

  const db = createAdminClient();
  const banking = parseBankingFormData(formData);
  const { error } = await db
    .from("profiles")
    .update(bankingToDbPayload(banking, profile))
    .eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't save banking details." };

  await markStep(profile.id, profile.org_id ?? null, "banking");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function saveEmergency(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const orgError = requireOrg(profile);
  if (orgError) return orgError;

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      emergency_name: String(formData.get("emergency_name") ?? "") || null,
      emergency_phone: String(formData.get("emergency_phone") ?? "") || null,
      emergency_relation:
        String(formData.get("emergency_relation") ?? "") || null,
    })
    .eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't save emergency contact." };

  await markStep(profile.id, profile.org_id ?? null, "emergency");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function skipStep(step: string): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const orgError = requireOrg(profile);
  if (orgError) return orgError;
  if (step !== "emergency") {
    return { ok: false, message: "This step cannot be skipped." };
  }
  await markStep(profile.id, profile.org_id ?? null, step);
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Skipped." };
}

export async function completeOnboarding(): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const orgError = requireOrg(profile);
  if (orgError) return orgError;

  const db = createAdminClient();
  const { data: steps } = await db
    .from("onboarding_steps")
    .select("step")
    .eq("employee_id", profile.id)
    .not("completed_at", "is", null);

  const done = new Set((steps ?? []).map((s) => s.step));
  const missing = REQUIRED_STEPS.filter((s) => !done.has(s));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Complete required steps first: ${missing.join(", ")}.`,
    };
  }

  await db
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", profile.id);

  for (const step of [...REQUIRED_STEPS, "emergency", "complete"]) {
    await markStep(profile.id, profile.org_id ?? null, step);
  }

  await writeAudit({
    actorId: profile.id,
    orgId: profile.org_id ?? null,
    action: "onboarding_completed",
    entity: "profiles",
    payload: { profile_id: profile.id },
  });

  revalidatePath("/app/dashboard");
  return { ok: true, message: "Onboarding complete." };
}
