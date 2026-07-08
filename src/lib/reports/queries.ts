import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { trustRequiredOrgScope } from "@/lib/org-scope";
import type { Profile } from "@/types/db";

export type ReportDatePreset =
  | "this_week"
  | "this_month"
  | "last_month"
  | "custom";

export type ReportDateRange = {
  preset: ReportDatePreset;
  from: string;
  to: string;
};

export type PersonalReportData = {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  byProject: { projectId: string | null; name: string; hours: number }[];
};

export type OrgMemberReportRow = {
  memberId: string;
  name: string;
  email: string;
  hours: number;
  billablePct: number;
  utilizationPct: number;
};

export type OrgProjectReportRow = {
  projectId: string | null;
  name: string;
  hours: number;
  billableHours: number;
  estimatedProfit: number | null;
};

export type OrgReportData = {
  totalHours: number;
  byMember: OrgMemberReportRow[];
  byProject: OrgProjectReportRow[];
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function resolveReportRange(
  preset: ReportDatePreset,
  from?: string,
  to?: string,
): ReportDateRange {
  const today = new Date();
  if (preset === "this_week") {
    const start = mondayOf(today);
    return {
      preset,
      from: toIso(start),
      to: toIso(today),
    };
  }
  if (preset === "this_month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { preset, from: toIso(start), to: toIso(today) };
  }
  if (preset === "last_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { preset, from: toIso(start), to: toIso(end) };
  }
  const f = from && ISO.test(from) ? from : toIso(today);
  const t = to && ISO.test(to) ? to : f;
  return { preset: "custom", from: f, to: t };
}

type EntryRow = {
  employee_id: string;
  project_id: string | null;
  total_hours: number;
  billable: boolean;
};

export async function getPersonalReport(
  profile: Profile,
  range: ReportDateRange,
): Promise<PersonalReportData> {
  const db = createAdminClient();
  const orgId = profile.org_id ?? null;

  let query = db
    .from("time_entries")
    .select("employee_id, project_id, total_hours, billable")
    .eq("employee_id", profile.id)
    .gte("entry_date", range.from)
    .lte("entry_date", range.to);

  query = orgId ? query.eq("org_id", orgId) : query.is("org_id", null);

  const { data: entries } = await query;
  const rows = (entries ?? []) as EntryRow[];

  let totalHours = 0;
  let billableHours = 0;
  const byProjectMap = new Map<
    string | null,
    { projectId: string | null; hours: number }
  >();

  for (const e of rows) {
    const h = Number(e.total_hours) || 0;
    if (h <= 0) continue;
    totalHours += h;
    if (e.billable) billableHours += h;
    const key = e.project_id;
    const cur = byProjectMap.get(key) ?? { projectId: key, hours: 0 };
    cur.hours += h;
    byProjectMap.set(key, cur);
  }

  const projectIds = [...byProjectMap.keys()].filter(Boolean) as string[];
  const projectNames = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects } = await db
      .from("projects")
      .select("id, name")
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectNames.set(p.id, p.name);
    }
  }

  const byProject = [...byProjectMap.values()]
    .map((p) => ({
      projectId: p.projectId,
      name: p.projectId
        ? projectNames.get(p.projectId) ?? "Unknown project"
        : "No project",
      hours: p.hours,
    }))
    .sort((a, b) => b.hours - a.hours);

  return {
    totalHours,
    billableHours,
    nonBillableHours: Math.max(0, totalHours - billableHours),
    byProject,
  };
}

/** Standard work hours in range for utilization (8h × weekdays, capped by range length). */
function expectedHoursInRange(from: string, to: string): number {
  const start = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return days * 8;
}

export async function getOrgReport(
  orgId: string,
  range: ReportDateRange,
): Promise<OrgReportData> {
  // Defense-in-depth: re-assert the caller's org matches the requested one
  // (service-role queries below bypass RLS). Mirrors dashboard/audit queries.
  orgId = await trustRequiredOrgScope(orgId);
  const db = createAdminClient();
  const expected = expectedHoursInRange(range.from, range.to);

  const [{ data: entries }, { data: memberships }] = await Promise.all([
    db
      .from("time_entries")
      .select("employee_id, project_id, total_hours, billable")
      .eq("org_id", orgId)
      .gte("entry_date", range.from)
      .lte("entry_date", range.to),
    db.from("memberships").select("user_id").eq("org_id", orgId),
  ]);

  const memberIds = (memberships ?? []).map((m) => m.user_id as string);
  const profilesById = new Map<
    string,
    { full_name: string | null; email: string }
  >();
  if (memberIds.length > 0) {
    const { data: profs } = await db
      .from("profiles")
      .select("id, full_name, email")
      .in("id", memberIds);
    for (const p of profs ?? []) {
      profilesById.set(p.id, {
        full_name: p.full_name,
        email: p.email,
      });
    }
  }

  const rows = (entries ?? []) as EntryRow[];
  const byMember = new Map<
    string,
    { hours: number; billable: number }
  >();
  const byProject = new Map<
    string | null,
    { hours: number; billable: number }
  >();
  let totalHours = 0;

  for (const e of rows) {
    const h = Number(e.total_hours) || 0;
    if (h <= 0) continue;
    totalHours += h;
    const mem = byMember.get(e.employee_id) ?? { hours: 0, billable: 0 };
    mem.hours += h;
    if (e.billable) mem.billable += h;
    byMember.set(e.employee_id, mem);

    const proj = byProject.get(e.project_id) ?? { hours: 0, billable: 0 };
    proj.hours += h;
    if (e.billable) proj.billable += h;
    byProject.set(e.project_id, proj);
  }

  const projectIds = [...byProject.keys()].filter(Boolean) as string[];
  const projectMeta = new Map<string, { name: string }>();
  if (projectIds.length > 0) {
    const { data: projects } = await db
      .from("projects")
      .select("id, name")
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectMeta.set(p.id, { name: p.name });
    }
  }

  const memberRows: OrgMemberReportRow[] = [...byMember.entries()]
    .map(([memberId, stats]) => {
      const prof = profilesById.get(memberId);
      return {
        memberId,
        name: prof?.full_name?.trim() || prof?.email || "Unknown",
        email: prof?.email ?? "",
        hours: stats.hours,
        billablePct:
          stats.hours > 0 ? Math.round((stats.billable / stats.hours) * 100) : 0,
        utilizationPct:
          expected > 0 ? Math.round((stats.hours / expected) * 100) : 0,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const projectRows: OrgProjectReportRow[] = [...byProject.entries()]
    .map(([projectId, stats]) => ({
      projectId,
      name: projectId
        ? projectMeta.get(projectId)?.name ?? "Unknown project"
        : "No project",
      hours: stats.hours,
      billableHours: stats.billable,
      // hourly_rate not on projects schema — skip profitability gracefully
      estimatedProfit: null,
    }))
    .sort((a, b) => b.hours - a.hours);

  return {
    totalHours,
    byMember: memberRows,
    byProject: projectRows,
  };
}
