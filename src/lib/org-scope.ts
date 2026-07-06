import "server-only";

import { getWorkspaceContext } from "@/lib/workspace";

export async function trustOrgScope(
  requested: string | null | undefined,
): Promise<string | null> {
  const ctx = await getWorkspaceContext();
  if (!ctx) throw new Error("Unauthorized");

  if (ctx.isSuperadmin) {
    return requested?.trim() || null;
  }

  if (!ctx.activeOrgId) {
    if (requested && requested !== ctx.activeOrgId) {
      throw new Error("Org scope mismatch");
    }
    return null;
  }

  if (requested && requested !== ctx.activeOrgId) {
    throw new Error("Org scope mismatch");
  }

  return ctx.activeOrgId;
}

export async function trustRequiredOrgScope(
  requested: string,
): Promise<string> {
  const scoped = await trustOrgScope(requested);
  if (!scoped) throw new Error("Org scope required");
  return scoped;
}
