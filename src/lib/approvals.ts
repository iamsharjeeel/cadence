import "server-only";

import { fetchOrgSettings } from "@/lib/org-settings/actions";
import type { ApproverScope } from "@/types/org-settings";
import type { WorkspaceRole } from "@/lib/workspace";

export async function canApproveInOrg(
  orgId: string,
  workspaceRole: WorkspaceRole | null,
): Promise<boolean> {
  if (!workspaceRole) return false;
  if (workspaceRole === "owner") return true;
  if (workspaceRole !== "admin") return false;

  const settings = await fetchOrgSettings(orgId);
  const scope: ApproverScope =
    settings?.approver_scope === "owner_and_managers"
      ? "owner_and_managers"
      : "owner_only";

  return scope === "owner_and_managers";
}
