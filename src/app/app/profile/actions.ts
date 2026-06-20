"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { bankingToDbPayload, parseBankingFormData } from "@/lib/banking";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateCurrency, validateIsoDate, validateMaxLength, validateRate } from "@/lib/validation";
import { RATE_TYPES } from "@/types/db";
import type { RateType } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

/**
 * Updates the caller's OWN display name. Role and status are admin-managed only.
 */
export async function updateOwnName(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { ok: false, message: "Name can't be empty." };
  if (fullName.length > 80)
    return { ok: false, message: "Name must be 80 characters or fewer." };

  const supabase = createClient();
  // RLS only allows a user to update their own row; we also scope by id here.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", profile.id);

  if (error) return { ok: false, message: "Couldn't save your name." };

  revalidatePath("/app/profile");
  return { ok: true, message: "Name updated." };
}

/** Updates the caller's own banking & tax fields (employee-editable). */
export async function updateOwnBanking(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const input = parseBankingFormData(formData);

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update(
      bankingToDbPayload(input, {
        bank_account_number: profile.bank_account_number,
        bank_bsb_swift: profile.bank_bsb_swift,
      }),
    )
    .eq("id", profile.id);

  if (error) return { ok: false, message: "Couldn't save banking details." };

  revalidatePath("/app/profile");
  return { ok: true, message: "Banking details saved." };
}

export async function updateOwnEmployment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();

  const jobTitleV = validateMaxLength(
    String(formData.get("job_title") ?? ""),
    80,
    "Job title",
  );
  if (!jobTitleV.ok) return { ok: false, message: jobTitleV.error };

  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  let startDate: string | null;
  if (startDateRaw) {
    const startV = validateIsoDate(startDateRaw, "Start date");
    if (!startV.ok) return { ok: false, message: startV.error };
    startDate = startV.value;
  } else {
    startDate = null;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      job_title: jobTitleV.value || null,
      start_date: startDate,
    })
    .eq("id", profile.id);

  if (error) return { ok: false, message: "Couldn't save employment details." };

  revalidatePath("/app/profile");
  return { ok: true, message: "Employment details saved." };
}

/** Employee self-service rate update — no approval gate. */
export async function updateOwnRate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();

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
    .eq("id", profile.id);

  if (error) return { ok: false, message: "Couldn't save your rate." };

  await writeAudit({
    actorId: profile.id,
    orgId: profile.org_id,
    action: "profile.rate_change",
    entity: profile.id,
    payload: {
      source: "self",
      from: {
        rate: profile.rate,
        rate_type: profile.rate_type,
        currency: profile.currency,
      },
      to: {
        rate: rate.value,
        rate_type: rateType,
        currency: currency.value,
      },
    },
  });

  revalidatePath("/app/profile");
  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  return { ok: true, message: "Rate updated." };
}

export async function updateOwnEmergency(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      emergency_name: String(formData.get("emergency_name") ?? "").trim() || null,
      emergency_phone: String(formData.get("emergency_phone") ?? "").trim() || null,
      emergency_relation:
        String(formData.get("emergency_relation") ?? "").trim() || null,
    })
    .eq("id", profile.id);

  if (error) return { ok: false, message: "Couldn't save emergency contact." };

  revalidatePath("/app/profile");
  return { ok: true, message: "Emergency contact saved." };
}

/** Updates the caller's own avatar URL (pointing to a preset or an uploaded file). */
export async function updateOwnAvatar(url: string | null): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url || null })
    .eq("id", profile.id);

  if (error) return { ok: false, message: "Couldn't save avatar." };

  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true, message: "Avatar updated." };
}

/** Uploads an avatar image to the private avatars bucket and saves the storage path to the profile.
 *  The returned `url` is the raw storage path (e.g. "{userId}/avatar.jpg").
 *  Use `resolveAvatarUrl` from @/lib/avatar-url to turn it into a displayable URL.
 */
export async function uploadProfileAvatar(formData: FormData): Promise<ActionResult & { url?: string }> {
  const profile = await requireActiveProfile();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, message: "No file provided." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, message: "File must be under 2 MB." };

  const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) return { ok: false, message: "Unsupported file type." };

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const storagePath = `${profile.id}/avatar.${ext}`;

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (uploadError) return { ok: false, message: "Upload failed." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: storagePath })
    .eq("id", profile.id);

  if (updateError) return { ok: false, message: "Uploaded but couldn't save path." };

  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true, message: "Avatar uploaded.", url: storagePath };
}
