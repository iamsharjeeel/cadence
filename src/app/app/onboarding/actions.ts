"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireActiveProfile } from "@/lib/auth";
import { encryptBankField } from "@/lib/bank-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; message: string };

const STEPS = [
  "personal",
  "employment",
  "banking",
  "emergency",
  "documents",
  "complete",
] as const;

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

  const fullName = String(formData.get("full_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({ full_name: fullName || profile.full_name, address: address || null })
    .eq("id", profile.id);
  if (error) return { ok: false, message: "Couldn't save personal details." };

  await markStep(profile.id, profile.org_id, "personal");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Saved." };
}

export async function saveEmployment(formData: FormData): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "No organization." };

  const jobTitle = String(formData.get("job_title") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "") || null;

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      ...(jobTitle ? { job_title: jobTitle } : {}),
      ...(startDate && !profile.start_date ? { start_date: startDate } : {}),
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
  const { error } = await db
    .from("profiles")
    .update({
      bank_name: String(formData.get("bank_name") ?? "") || null,
      bank_account_name: String(formData.get("bank_account_name") ?? "") || null,
      bank_account_number: encryptBankField(
        String(formData.get("bank_account_number") ?? ""),
      ),
      bank_bsb_swift: encryptBankField(
        String(formData.get("bank_bsb_swift") ?? ""),
      ),
      tax_id: String(formData.get("tax_id") ?? "") || null,
      payment_terms_days: Number(formData.get("payment_terms_days") ?? 14) || 14,
    })
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
  await db
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", profile.id);

  for (const step of STEPS) {
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
