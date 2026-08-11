import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { trustOrgScope } from "@/lib/org-scope";
import { entryHoursWithOptionalPersistedFallback } from "@/lib/time/entry-hours";
import type { Profile, Timesheet } from "@/types/db";
import { currentMonthRange, isoWeekKey, lastNWeeks } from "./period";

/** Time-entry columns needed to compute hours with overnight wrapping. */
const ENTRY_HOURS_SELECT = "start_time, end_time, entry_mode, decimal_hours";

type EntryHoursRow = {
  start_time?: string | null;
  end_time?: string | null;
  entry_mode?: string | null;
  decimal_hours?: number | null;
  total_hours?: number | null;
};

/** Hours for a single entry, wrapping overnight (never the negative generated column). */
function entryHours(r: EntryHoursRow): number {
  return entryHoursWithOptionalPersistedFallback(r);
}

export type CurrencyTotals = Record<string, number>;

export type EmployeeDashboardData = {
  approvedHoursMonth: number;
  earningsByCurrency: CurrencyTotals;
  recentTimesheets: Timesheet[];
  hoursByPeriod: { label: string; hours: number }[];
};

export type EmployeeBreakdownRow = {
  id: string;
  name: string;
  role: string;
  rate: number | null;
  currency: string;
  approvedHours: number;
  estimatedTotal: number;
};

export type AdminDashboardData = {
  pendingCount: number;
  approvedHoursPeriod: number;
  payrollByCurrency: CurrencyTotals;
  employeeBreakdown: EmployeeBreakdownRow[];
  hoursByEmployee: { name: string; hours: number }[];
  weeklyTrend: { week: string; hours: number; currency: string }[];
  recentActivity: {
    id: string;
    action: string;
    created_at: string;
    actorName: string;
  }[];
};

export type OrgSummaryCard = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  employeeCount: number;
  pendingCount: number;
  approvedHoursPeriod: number;
};

function sumEntryHours(rows: EntryHoursRow[]): number {
  return Math.round(rows.reduce((s, r) => s + entryHours(r), 0) * 100) / 100;
}

function monthRange() {
  return currentMonthRange();
}

/** Employee dashboard — own data only. */
export async function getEmployeeDashboard(
  profile: Profile,
): Promise<EmployeeDashboardData> {
  const db = createAdminClient();
  const { start } = monthRange();

  const { data: timesheets } = await db
    .from("timesheets")
    .select("*")
    .eq("employee_id", profile.id)
    .eq("status", "approved")
    .order("period_start", { ascending: false });

  const approved = (timesheets ?? []) as Timesheet[];
  const approvedIds = approved.map((t) => t.id);

  const earningsByCurrency: CurrencyTotals = {};
  for (const t of approved) {
    const cur = t.currency_snapshot ?? "USD";
    earningsByCurrency[cur] =
      (earningsByCurrency[cur] ?? 0) + (t.calculated_total ?? 0);
  }

  const approvedThisMonth = approved.filter(
    (t) => t.approved_at && t.approved_at >= start,
  );
  const approvedMonthIds = approvedThisMonth.map((t) => t.id);

  let approvedHoursMonth = 0;
  if (approvedMonthIds.length > 0) {
    const { data: entries } = await db
      .from("time_entries")
      .select(ENTRY_HOURS_SELECT)
      .in("timesheet_id", approvedMonthIds);
    approvedHoursMonth = sumEntryHours(entries ?? []);
  }

  const hoursByPeriod = await Promise.all(
    approved.slice(0, 6).map(async (t) => {
      const { data: entries } = await db
        .from("time_entries")
        .select(ENTRY_HOURS_SELECT)
        .eq("timesheet_id", t.id);
      return {
        label: t.period_start.slice(5),
        hours: sumEntryHours(entries ?? []),
      };
    }),
  );
  hoursByPeriod.reverse();

  const { data: recent } = await db
    .from("timesheets")
    .select("*")
    .eq("employee_id", profile.id)
    .order("period_start", { ascending: false })
    .limit(5);

  const result: EmployeeDashboardData = {
    approvedHoursMonth,
    earningsByCurrency,
    recentTimesheets: (recent ?? []) as Timesheet[],
    hoursByPeriod,
  };

  return result;
}

/** Admin dashboard — scoped to one org, or all orgs when orgId is null (superadmin). */
export async function getAdminDashboard(
  orgId: string | null,
): Promise<AdminDashboardData> {
  const scopedOrgId = await trustOrgScope(orgId);
  const db = createAdminClient();
  const { start } = monthRange();

  let pendingQuery = db
    .from("timesheets")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");
  if (scopedOrgId) pendingQuery = pendingQuery.eq("org_id", scopedOrgId);
  const { count: pendingCount } = await pendingQuery;

  let approvedQuery = db
    .from("timesheets")
    .select("*")
    .eq("status", "approved")
    .gte("approved_at", start);
  if (scopedOrgId) approvedQuery = approvedQuery.eq("org_id", scopedOrgId);
  const { data: approvedSheets } = await approvedQuery;

  const approved = (approvedSheets ?? []) as Timesheet[];
  const approvedIds = approved.map((t) => t.id);

  let approvedHoursPeriod = 0;
  const hoursByEmployeeMap = new Map<string, number>();
  const weeklyMap = new Map<string, number>();

  if (approvedIds.length > 0) {
    const { data: entries } = await db
      .from("time_entries")
      .select(`${ENTRY_HOURS_SELECT}, entry_date, timesheet_id`)
      .in("timesheet_id", approvedIds);

    const sheetById = new Map(approved.map((t) => [t.id, t]));

    for (const row of entries ?? []) {
      if (!row.timesheet_id) continue;
      const hrs = entryHours(row);
      approvedHoursPeriod += hrs;
      const sheet = sheetById.get(row.timesheet_id);
      if (sheet) {
        hoursByEmployeeMap.set(
          sheet.employee_id,
          (hoursByEmployeeMap.get(sheet.employee_id) ?? 0) + hrs,
        );
        const week = isoWeekKey(row.entry_date);
        weeklyMap.set(week, (weeklyMap.get(week) ?? 0) + hrs);
      }
    }
  }

  const payrollByCurrency: CurrencyTotals = {};
  for (const t of approved) {
    const cur = t.currency_snapshot ?? "USD";
    payrollByCurrency[cur] =
      (payrollByCurrency[cur] ?? 0) + (t.calculated_total ?? 0);
  }

  // Track C: org members come from `memberships`, not the (now-null) profiles.org_id.
  let memQuery = db.from("memberships").select("user_id, role");
  if (scopedOrgId) memQuery = memQuery.eq("org_id", scopedOrgId);
  const { data: memRows } = await memQuery;
  const memberIds = [
    ...new Set((memRows ?? []).map((m: any) => m.user_id as string)),
  ] as string[];
  const roleByUser = new Map<string, string>(
    (memRows ?? []).map((m: any) => [m.user_id as string, m.role as string]),
  );

  let profiles: { id: string; full_name: string | null; email: string; rate: number | null; currency: string | null }[] = [];
  if (memberIds.length > 0) {
    const { data } = await db
      .from("profiles")
      .select("id, full_name, email, rate, currency")
      .in("id", memberIds);
    profiles = (data ?? []) as typeof profiles;
  }

  const employeeBreakdown: EmployeeBreakdownRow[] = [];

  for (const p of profiles) {
    const name = p.full_name?.trim() || p.email;
    const hrs = hoursByEmployeeMap.get(p.id) ?? 0;
    let estimatedTotal = 0;
    for (const t of approved) {
      if (t.employee_id === p.id) {
        estimatedTotal += t.calculated_total ?? 0;
      }
    }
    employeeBreakdown.push({
      id: p.id,
      name,
      role: roleByUser.get(p.id) ?? "employee",
      rate: p.rate,
      currency: p.currency ?? "USD",
      approvedHours: hrs,
      estimatedTotal,
    });
  }
  employeeBreakdown.sort((a, b) => b.approvedHours - a.approvedHours);

  const hoursByEmployee = employeeBreakdown
    .filter((e) => e.approvedHours > 0)
    .map((e) => ({ name: e.name, hours: e.approvedHours }));

  const weeks = lastNWeeks(8);
  const weeklyTrend = weeks.map((week) => ({
    week,
    hours: weeklyMap.get(week) ?? 0,
    currency: "mixed",
  }));

  let activityQuery = db
    .from("audit_log")
    .select("id, action, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(10);
  if (scopedOrgId) activityQuery = activityQuery.eq("org_id", scopedOrgId);
  const { data: activity } = await activityQuery;

  const actorIds = [
    ...new Set((activity ?? []).map((a) => a.actor_id).filter(Boolean)),
  ] as string[];
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await db
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const a of actors ?? []) {
      actorNames.set(a.id, a.full_name?.trim() || a.email);
    }
  }

  return {
    pendingCount: pendingCount ?? 0,
    approvedHoursPeriod,
    payrollByCurrency,
    employeeBreakdown,
    hoursByEmployee,
    weeklyTrend,
    recentActivity: (activity ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      created_at: a.created_at,
      actorName: a.actor_id ? actorNames.get(a.actor_id) ?? "System" : "System",
    })),
  };
}

/** Superadmin org overview cards. */
export async function getSuperadminOrgSummaries(): Promise<OrgSummaryCard[]> {
  const db = createAdminClient();
  const { start } = monthRange();

  const [
    { data: orgs },
    { data: memberships },
    { data: submitted },
    { data: approved },
  ] = await Promise.all([
    db.from("organizations").select("id, name, slug, logo_url").order("name"),
    db.from("memberships").select("org_id"),
    db.from("timesheets").select("org_id").eq("status", "submitted"),
    db
      .from("timesheets")
      .select("id, org_id")
      .eq("status", "approved")
      .gte("approved_at", start),
  ]);

  const approvedById = new Map((approved ?? []).map((row) => [row.id, row.org_id]));
  const approvedIds = [...approvedById.keys()];
  const entries = approvedIds.length
    ? (
        await db
          .from("time_entries")
          .select(`timesheet_id, ${ENTRY_HOURS_SELECT}`)
          .in("timesheet_id", approvedIds)
      ).data ?? []
    : [];

  const memberCounts = new Map<string, number>();
  for (const row of memberships ?? []) {
    memberCounts.set(row.org_id, (memberCounts.get(row.org_id) ?? 0) + 1);
  }
  const pendingCounts = new Map<string, number>();
  for (const row of submitted ?? []) {
    if (!row.org_id) continue;
    pendingCounts.set(row.org_id, (pendingCounts.get(row.org_id) ?? 0) + 1);
  }
  const approvedHours = new Map<string, number>();
  for (const row of entries) {
    const orgId = row.timesheet_id ? approvedById.get(row.timesheet_id) : null;
    if (!orgId) continue;
    approvedHours.set(
      orgId,
      (approvedHours.get(orgId) ?? 0) + entryHours(row),
    );
  }

  return (orgs ?? []).map((org) => {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logo_url ?? null,
      employeeCount: memberCounts.get(org.id) ?? 0,
      pendingCount: pendingCounts.get(org.id) ?? 0,
      approvedHoursPeriod:
        Math.round((approvedHours.get(org.id) ?? 0) * 100) / 100,
    };
  });
}
