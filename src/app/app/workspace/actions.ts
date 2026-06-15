"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";

import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth";

/**
 * Switch the caller's active workspace. Personal = null. Org switches go
 * through set_active_workspace(), which REFUSES an org the caller is not a
 * member of — so the UI can never point RLS at a workspace the user lacks.
 */
export async function switchWorkspace(orgId: string | null): Promise<void> {
  await requireActiveProfile();
  const supabase = createClient() as any;
  const { error } = await supabase.rpc("set_active_workspace", {
    p_org_id: orgId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
  redirect("/app/dashboard");
}

/**
 * Self-serve org creation: any active user creates an org and becomes its
 * OWNER (atomic org + owner membership via the create_organization RPC), then
 * is switched into it. No superadmin involved.
 */
export async function createOrganizationAction(
  formData: FormData,
): Promise<void> {
  await requireActiveProfile();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Organization name is required");

  const supabase = createClient() as any;
  try {
    const { data: orgId, error } = await supabase.rpc("create_organization", {
      p_name: name,
    });
    if (error) throw new Error(error.message);
    const { error: switchError } = await supabase.rpc("set_active_workspace", {
      p_org_id: orgId,
    });
    if (switchError) throw new Error(switchError.message);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    throw e;
  }
  revalidatePath("/app", "layout");
  redirect("/app/dashboard");
}
