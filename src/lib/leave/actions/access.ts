import "server-only";

import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/workspace";

export async function requireLeaveOrgWorkspace() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  if (!ctx.activeOrgId) {
    return { ok: false as const, message: "Switch to an organization workspace." };
  }
  return { ok: true as const, ctx, orgId: ctx.activeOrgId };
}

export async function requireLeaveOrgManager() {
  const gate = await requireLeaveOrgWorkspace();
  if (!gate.ok) return gate;
  const { ctx, orgId } = gate;
  if (ctx.workspaceRole !== "owner" && ctx.workspaceRole !== "admin") {
    return { ok: false as const, message: "Forbidden." };
  }
  return { ok: true as const, ctx, orgId, profile: ctx.effectiveProfile };
}
