"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireActiveProfile } from "@/lib/auth";
import { bankingToDbPayload, parseBankingFormData } from "@/lib/banking";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateIsoDate, validateMaxLength } from "@/lib/validation";

export type ActionResult = { ok: boolean; message: string };

const REQUIRED_STEPS = ["personal", "employment", "banking"] as const;

async function markStep(
  profileId: string,
  orgId: string,
  step: string,
): Promise<void> {
  const db = createAdminClient();
  await db.from("onboarding_steps").upsert(
    {
      org_id: orgId,
      employee_id: profileId,
      step,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,step" },
  );
}

export async function savePersonal(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "No organization." };

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

  await markStep(profile.id, profile.org_id, "personal");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function saveEmployment(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "No organization." };

  const jobTitleV = validateMaxLength(
    String(formData.get("job_title") ?? ""),
    80,
    "Job title",
  );
  if (!jobTitleV.ok) return { ok: false, message: jobTitleV.error };
  const startDateRaw = String(formData.get("start_date") ?? "");
  let startDate: string | null = null;
  if (startDateRaw && !profile.start_date) {
    const startV = validateIsoDate(startDateRaw, "Start date");
    if (!startV.ok) return { ok: false, message: startV.error };
    startDate = startV.value;
  }

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      ...(jobTitleV.value ? { job_title: jobTitleV.value } : {}),
      ...(startDate ? { start_date: startDate } : {}),
    })
    .eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't save employment details." };

  await markStep(profile.id, profile.org_id, "employment");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function saveBanking(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "No organization." };

  const db = createAdminClient();
  const banking = parseBankingFormData(formData);
  const { error } = await db
    .from("profiles")
    .update(bankingToDbPayload(banking, profile))
    .eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't save banking details." };

  await markStep(profile.id, profile.org_id, "banking");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function saveEmergency(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "No organization." };

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

  await markStep(profile.id, profile.org_id, "emergency");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function skipStep(step: string): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "No organization." };
  if (step !== "emergency" && step !== "documents") {
    return { ok: false, message: "This step cannot be skipped." };
  }
  await markStep(profile.id, profile.org_id, step);
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Skipped." };
}

export async function completeOnboarding(): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "No organization." };

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

  for (const step of [...REQUIRED_STEPS, "emergency", "documents", "complete"]) {
    await markStep(profile.id, profile.org_id, step);
  }

  await writeAudit({
    actorId: profile.id,
    orgId: profile.org_id,
    action: "onboarding_completed",
    entity: "profiles",
    payload: { profile_id: profile.id },
  });

  revalidatePath("/app/dashboard");
  return { ok: true, message: "Onboarding complete." };
}
