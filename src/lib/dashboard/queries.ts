import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Timesheet } from "@/types/db";
import { currentMonthRange, isoWeekKey, lastNWeeks } from "./period";

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
  employeeCount: number;
  pendingCount: number;
  approvedHoursPeriod: number;
};

function sumHours(rows: { hours: number }[]): number {
  return rows.reduce((s, r) => s + Number(r.hours), 0);
}

function monthRange() {
  return currentMonthRange();
}

/** Employee dashboard — own data only. */
export async function getEmployeeDashboard(
  profile: Profile,
): Promise<EmployeeDashboardData> {
  const db = createAdminClient();
  const { start, end } = monthRange();

  const { data: timesheets } = await db
    .from("timesheets")
    .select("*")
    .eq("employee_id", profile.id)
    .order("period_start", { ascending: false });

  const all = (timesheets ?? []) as Timesheet[];
  const approved = all.filter((t) => t.status === "approved");
  const approvedThisMonth = approved.filter(
    (t) => t.period_start <= end && t.period_end >= start,
  );

  const approvedIds = approvedThisMonth.map((t) => t.id);
  let approvedHoursMonth = 0;
  if (approvedIds.length > 0) {
    const { data: rows } = await db
      .from("timesheet_rows")
      .select("hours")
      .in("timesheet_id", approvedIds);
    approvedHoursMonth = sumHours(rows ?? []);
  }

  const earningsByCurrency: CurrencyTotals = {};
  for (const t of approvedThisMonth) {
    const cur = t.currency_snapshot ?? "USD";
    earningsByCurrency[cur] =
      (earningsByCurrency[cur] ?? 0) + (t.calculated_total ?? 0);
  }

  const hoursByPeriod = await Promise.all(
    approved.slice(0, 6).map(async (t) => {
      const { data: rows } = await db
        .from("timesheet_rows")
        .select("hours")
        .eq("timesheet_id", t.id);
      return {
        label: t.period_start.slice(5),
        hours: sumHours(rows ?? []),
      };
    }),
  );
  hoursByPeriod.reverse();

  return {
    approvedHoursMonth,
    earningsByCurrency,
    recentTimesheets: all.slice(0, 5),
    hoursByPeriod,
  };
}

/** Admin dashboard — scoped to one org. Superadmin passes target org_id. */
export async function getAdminDashboard(orgId: string): Promise<AdminDashboardData> {
  const db = createAdminClient();
  const { start, end } = monthRange();

  const { count: pendingCount } = await db
    .from("timesheets")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "submitted");

  const { data: approvedSheets } = await db
    .from("timesheets")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "approved")
    .lte("period_start", end)
    .gte("period_end", start);

  const approved = (approvedSheets ?? []) as Timesheet[];
  const approvedIds = approved.map((t) => t.id);

  let approvedHoursPeriod = 0;
  const hoursByEmployeeMap = new Map<string, number>();
  const weeklyMap = new Map<string, number>();

  if (approvedIds.length > 0) {
    const { data: rows } = await db
      .from("timesheet_rows")
      .select("hours, row_date, timesheet_id")
      .in("timesheet_id", approvedIds);

    const sheetById = new Map(approved.map((t) => [t.id, t]));

    for (const row of rows ?? []) {
      const hrs = Number(row.hours);
      approvedHoursPeriod += hrs;
      const sheet = sheetById.get(row.timesheet_id);
      if (sheet) {
        hoursByEmployeeMap.set(
          sheet.employee_id,
          (hoursByEmployeeMap.get(sheet.employee_id) ?? 0) + hrs,
        );
        const week = isoWeekKey(row.row_date);
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

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, email, role, rate, currency")
    .eq("org_id", orgId)
    .neq("role", "superadmin");

  const nameById = new Map<string, string>();
  const employeeBreakdown: EmployeeBreakdownRow[] = [];

  for (const p of profiles ?? []) {
    const name = p.full_name?.trim() || p.email;
    nameById.set(p.id, name);
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
      role: p.role,
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

  const { data: activity } = await db
    .from("audit_log")
    .select("id, action, created_at, actor_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

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
  const { start, end } = monthRange();

  const { data: orgs } = await db
    .from("organizations")
    .select("id, name, slug")
    .order("name");

  const cards: OrgSummaryCard[] = [];

  for (const org of orgs ?? []) {
    const { count: employeeCount } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .neq("role", "superadmin");

    const { count: pendingCount } = await db
      .from("timesheets")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "submitted");

    const { data: approved } = await db
      .from("timesheets")
      .select("id")
      .eq("org_id", org.id)
      .eq("status", "approved")
      .lte("period_start", end)
      .gte("period_end", start);

    let approvedHoursPeriod = 0;
    const ids = (approved ?? []).map((t) => t.id);
    if (ids.length > 0) {
      const { data: rows } = await db
        .from("timesheet_rows")
        .select("hours")
        .in("timesheet_id", ids);
      approvedHoursPeriod = sumHours(rows ?? []);
    }

    cards.push({
      id: org.id,
      name: org.name,
      slug: org.slug,
      employeeCount: employeeCount ?? 0,
      pendingCount: pendingCount ?? 0,
      approvedHoursPeriod,
    });
  }

  return cards;
}
