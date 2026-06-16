"use server";

import { requireActiveProfile } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  getOrgReport,
  getPersonalReport,
  resolveReportRange,
  type OrgReportData,
  type PersonalReportData,
  type ReportDatePreset,
} from "@/lib/reports/queries";

export async function fetchPersonalReport(
  preset: ReportDatePreset,
  from?: string,
  to?: string,
): Promise<PersonalReportData> {
  const profile = await requireActiveProfile();
  const range = resolveReportRange(preset, from, to);
  return getPersonalReport(profile, range);
}

export async function fetchOrgReport(
  preset: ReportDatePreset,
  from?: string,
  to?: string,
): Promise<OrgReportData | { error: string }> {
  const ctx = await getWorkspaceContext();
  if (!ctx?.activeOrgId) {
    return { error: "Switch to an organization workspace." };
  }
  if (ctx.workspaceRole !== "owner" && ctx.workspaceRole !== "admin") {
    return { error: "Not authorized for organization reports." };
  }
  const range = resolveReportRange(preset, from, to);
  return getOrgReport(ctx.activeOrgId, range);
}
