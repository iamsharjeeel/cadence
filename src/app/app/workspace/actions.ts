"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveProfile } from "@/lib/auth";

export type ActionResult = { ok: boolean; message: string };

/**
 * Returns the caller's authenticated Supabase client (anon key + session cookies).
 * SECURITY DEFINER RPCs such as set_active_workspace() key off auth.uid(), so they
 * MUST run through this client — never the service-role admin client.
 */
async function authenticatedClient() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Session expired. Sign in again.");
  }
  return { supabase, user };
}

/**
 * Persists the caller's active workspace and verifies the row was written/deleted.
 */
async function persistActiveWorkspace(orgId: string | null): Promise<void> {
  const { supabase } = await authenticatedClient();

  const { error } = await supabase.rpc("set_active_workspace", {
    p_org_id: orgId,
  });
  if (error) throw new Error(error.message);

  const { data: row, error: readError } = await supabase
    .from("active_workspace")
    .select("org_id")
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (orgId) {
    if (row?.org_id !== orgId) {
      throw new Error("Workspace switch did not persist. Try again.");
    }
  } else if (row) {
    throw new Error("Could not switch to personal workspace. Try again.");
  }
}

function revalidateAppShell() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/employees");
  revalidatePath("/app/timesheets");
  revalidatePath("/app/projects");
  revalidatePath("/app/settings");
  revalidatePath("/app/audit");
}

/**
 * Switch the caller's active workspace. Personal = null. Org switches go
 * through set_active_workspace(), which REFUSES an org the caller is not a
 * member of — so the UI can never point RLS at a workspace the user lacks.
 */
export async function switchWorkspace(
  orgId: string | null,
): Promise<ActionResult> {
  try {
    await requireActiveProfile();
    await persistActiveWorkspace(orgId);
    revalidateAppShell();
    return { ok: true, message: "Workspace switched." };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Couldn't switch workspace.";
    return { ok: false, message };
  }
}

/**
 * Accept an invite addressed to the caller's email -> membership, then switch
 * into the org. accept_invite() refuses invites not addressed to the caller.
 */
export async function acceptInvite(inviteId: string): Promise<ActionResult> {
  try {
    const profile = await requireActiveProfile();
    const { supabase } = await authenticatedClient();

    const { data: orgId, error } = await supabase.rpc("accept_invite", {
      p_invite_id: inviteId,
    });
    if (error) throw new Error(error.message);
    if (!orgId) throw new Error("Invite could not be accepted.");

    const admin = createAdminClient();
    const { data: membership } = await admin
      .from("memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", profile.id)
      .maybeSingle();

    void dispatchWebhookEvent(orgId, {
      type: "member.joined",
      data: {
        user_id: profile.id,
        org_id: orgId,
        role: membership?.role ?? "employee",
        invite_id: inviteId,
      },
    });

    await persistActiveWorkspace(orgId);
    revalidateAppShell();
    return { ok: true, message: "Invite accepted." };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Couldn't accept invite.";
    return { ok: false, message };
  }
}

/**
 * Self-serve org creation: any active user creates an org and becomes its
 * OWNER (atomic org + owner membership via the create_organization RPC), then
 * is switched into it. Non-superadmins are capped at one owned org (DB enforced).
 */
export async function createOrganizationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireActiveProfile();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "Organization name is required." };

    const { supabase, user } = await authenticatedClient();

    const { data: orgId, error } = await supabase.rpc("create_organization", {
      p_name: name,
    });
    if (error) {
      const msg = error.message.includes("already own an organization")
        ? "You already own an organization."
        : error.message;
      return { ok: false, message: msg };
    }
    if (!orgId) {
      return { ok: false, message: "Organization could not be created." };
    }

    await writeAudit({
      actorId: user.id,
      orgId,
      action: "org.create",
      entity: orgId,
      payload: { name, source: "workspace_switcher" },
    });

    await persistActiveWorkspace(orgId);
    revalidateAppShell();
    return { ok: true, message: `${name} created.` };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Couldn't create organization.";
    return { ok: false, message };
  }
}
