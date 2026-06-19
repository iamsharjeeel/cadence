import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type OrgApprovalFlags = {
  timesheets: boolean;
  leave: boolean;
};

/**
 * Reads an org's approval-gate flags via the service-role client.
 *
 * Used by employee submit paths (timesheet / leave), so it must NOT go through
 * the owner/admin-gated `get_or_create_org_settings` RPC. A missing
 * `org_settings` row — or a null (personal) org — resolves to permissive
 * defaults (`false`): submission auto-approves and is never blocked.
 */
export async function getOrgApprovalFlags(
  orgId: string | null,
): Promise<OrgApprovalFlags> {
  if (!orgId) return { timesheets: false, leave: false };
  const db = createAdminClient();
  const { data } = await db
    .from("org_settings")
    .select("approvals_timesheets, approvals_leave")
    .eq("org_id", orgId)
    .maybeSingle();
  return {
    timesheets: data?.approvals_timesheets ?? false,
    leave: data?.approvals_leave ?? false,
  };
}
