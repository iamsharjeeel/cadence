"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { getWorkspaceContext } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import type { ApproverScope, OrgSettings } from "@/types/org-settings";

export type OrgSettingsActionResult = { ok: boolean; message: string };

export async function fetchOrgSettings(
  orgId: string,
): Promise<OrgSettings | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_org_settings", {
    p_org_id: orgId,
  });
  if (error || !data) return null;
  return data as OrgSettings;
}

export async function updateOrgApprovalSettings(input: {
  orgId: string;
  approvals_timesheets: boolean;
  approvals_leave: boolean;
  approvals_expenses: boolean;
  approver_scope: ApproverScope;
}): Promise<OrgSettingsActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };
  if (ctx.workspaceRole !== "owner") {
    return { ok: false, message: "Only the organization owner can change settings." };
  }
  if (ctx.activeOrgId !== input.orgId) {
    return { ok: false, message: "Switch to the correct organization workspace." };
  }

  const supabase = createClient();
  await supabase.rpc("get_or_create_org_settings", { p_org_id: input.orgId });

  const { error } = await supabase
    .from("org_settings")
    .update({
      approvals_timesheets: input.approvals_timesheets,
      approvals_leave: input.approvals_leave,
      approvals_expenses: input.approvals_expenses,
      approver_scope: input.approver_scope,
    })
    .eq("org_id", input.orgId);

  if (error) {
    return { ok: false, message: "Couldn't save approval settings." };
  }

  await writeAudit({
    actorId: ctx.realProfile.id,
    orgId: input.orgId,
    action: "org_settings_updated",
    entity: input.orgId,
    payload: {
      section: "approvals",
      approvals_timesheets: input.approvals_timesheets,
      approvals_leave: input.approvals_leave,
      approvals_expenses: input.approvals_expenses,
      approver_scope: input.approver_scope,
    },
  });

  revalidatePath("/app/employees");
  return { ok: true, message: "Approval settings saved." };
}
