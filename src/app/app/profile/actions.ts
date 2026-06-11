"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { bankingToDbPayload, parseBankingFormData } from "@/lib/banking";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

/**
 * Updates the caller's OWN display name. This is the only profile field a user
 * may change about themselves — role, rate, and status are deliberately NOT
 * accepted here. Even if the client posts them, they are ignored.
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

  const jobTitle = String(formData.get("job_title") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim() || null;

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      job_title: jobTitle || null,
      ...(startDate && !profile.start_date ? { start_date: startDate } : {}),
    })
    .eq("id", profile.id);

  if (error) return { ok: false, message: "Couldn't save employment details." };

  revalidatePath("/app/profile");
  return { ok: true, message: "Employment details saved." };
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
