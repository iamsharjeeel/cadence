"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
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
