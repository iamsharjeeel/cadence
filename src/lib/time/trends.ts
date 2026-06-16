import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PeriodCadence, Profile } from "@/types/db";
import { periodForDate, shiftPeriod, toIsoDate } from "@/lib/time/periods";
import { durationHours } from "@/lib/time/validation";

export type TrendRange = "weekly" | "fortnightly" | "monthly" | "6month" | "yearly";

/** Columns needed to recompute hours with overnight wrapping. */
const TREND_ENTRY_SELECT =
  "entry_date, billable, project_id, employee_id, start_time, end_time, entry_mode, decimal_hours";

type RawEntryRow = {
  entry_date: string;
  billable: boolean;
  project_id: string | null;
  employee_id: string;
  start_time: string | null;
  end_time: string | null;
  entry_mode: string | null;
  decimal_hours: number | null;
};

type EntryRow = {
  entry_date: string;
  total_hours: number;
  billable: boolean;
  project_id: string | null;
  employee_id: string;
};

/**
 * Normalise raw rows into EntryRow with overnight-wrapped `total_hours` so every
 * downstream reducer is correct — the DB total_hours column is negative for
 * overnight ranges (end < start).
 */
function withWrappedHours(rows: RawEntryRow[]): EntryRow[] {
  return rows.map((r) => ({
    entry_date: r.entry_date,
    billable: r.billable,
    project_id: r.project_id,
    employee_id: r.employee_id,
    total_hours:
      r.entry_mode === "decimal_hours" && r.decimal_hours != null
        ? Number(r.decimal_hours)
        : r.start_time && r.end_time
          ? durationHours(
              String(r.start_time).slice(0, 5),
              String(r.end_time).slice(0, 5),
            ) ?? 0
          : 0,
  }));
}

function rangeStart(range: TrendRange): string {
  const d = new Date();
  if (range === "weekly") d.setDate(d.getDate() - 7);
  else if (range === "fortnightly") d.setDate(d.getDate() - 14);
  else if (range === "monthly") d.setMonth(d.getMonth() - 1);
  else if (range === "6month") d.setMonth(d.getMonth() - 6);
  else d.setFullYear(d.getFullYear() - 1);
  return toIsoDate(d);
}

function heatmapStart(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return toIsoDate(d);
}

function eightWeeksAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 56);
  return toIsoDate(d);
}

async function loadProjects(projectIds: string[]) {
  if (!projectIds.length) return new Map<string, { name: string; color: string }>();
  const db = createAdminClient();
  const { data } = await db.from("projects").select("id, name, color").in("id", projectIds);
  return new Map((data ?? []).map((p) => [p.id, { name: p.name, color: p.color }]));
}

function buildTrendMetrics(
  rows: EntryRow[],
  projectMap: Map<string, { name: string; color: string }>,
  cadence: PeriodCadence,
) {
  const totalHours = rows.reduce((s, r) => s + Number(r.total_hours), 0);
  const billableHours = rows
    .filter((r) => r.billable)
    .reduce((s, r) => s + Number(r.total_hours), 0);

  const byProject = new Map<string, { name: string; color: string; hours: number }>();
  for (const r of rows) {
    const p = r.project_id ? projectMap.get(r.project_id) : null;
    const key = r.project_id ?? "none";
    const cur = byProject.get(key) ?? {
      name: p?.name ?? "No project",
      color: p?.color ?? "#6B6F76",
      hours: 0,
    };
    cur.hours += Number(r.total_hours);
    byProject.set(key, cur);
  }

  const eightWeeks = eightWeeksAgo();
  const recentRows = rows.filter((r) => r.entry_date >= eightWeeks);
  const byDay = new Map<number, number>();
  for (const r of recentRows) {
    const dow = new Date(r.entry_date).getDay();
    byDay.set(dow, (byDay.get(dow) ?? 0) + Number(r.total_hours));
  }

  const periodLine: { label: string; hours: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 14);
    const p = periodForDate(toIsoDate(d), cadence);
    const hours = rows
      .filter((r) => r.entry_date >= p.start && r.entry_date <= p.end)
      .reduce((s, r) => s + Number(r.total_hours), 0);
    periodLine.push({ label: p.label, hours });
  }

  const heatmapDates = new Map<string, number>();
  const start = heatmapStart();
  const today = toIsoDate(new Date());
  let cur = start;
  while (cur <= today) {
    heatmapDates.set(cur, 0);
    const d = new Date(cur);
    d.setDate(d.getDate() + 1);
    cur = toIsoDate(d);
  }
  for (const r of rows) {
    if (r.entry_date >= start) {
      heatmapDates.set(
        r.entry_date,
        (heatmapDates.get(r.entry_date) ?? 0) + Number(r.total_hours),
      );
    }
  }

  const topProject = [...byProject.values()].sort((a, b) => b.hours - a.hours)[0];
  const loggedDays = new Set(rows.map((r) => r.entry_date)).size;

  return {
    totalHours,
    billableHours,
    nonBillableHours: totalHours - billableHours,
    avgHoursPerDay: loggedDays ? totalHours / loggedDays : 0,
    topProject: topProject?.name ?? "—",
    periodLine,
    projectBars: [...byProject.values()].sort((a, b) => b.hours - a.hours),
    dayOfWeek: [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow]!,
      hours: (byDay.get(dow) ?? 0) / 8,
    })),
    heatmap: [...heatmapDates.entries()].map(([date, hours]) => ({ date, hours })),
  };
}

export async function getEmployeeTrends(profile: Profile, range: TrendRange) {
  const db = createAdminClient();
  const since = rangeStart(range);
  let query = db
    .from("time_entries")
    .select(TREND_ENTRY_SELECT)
    .eq("employee_id", profile.id)
    .gte("entry_date", since);

  // Scope to the active workspace so personal and org contexts stay isolated.
  if (profile.org_id) query = query.eq("org_id", profile.org_id);
  else query = query.is("org_id", null);

  const { data: entries } = await query;

  const rows = withWrappedHours((entries ?? []) as RawEntryRow[]);
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
  const projectMap = await loadProjects(projectIds);

  const cadence = profile.org_id
    ? ((await db
        .from("organizations")
        .select("default_cadence")
        .eq("id", profile.org_id)
        .single()).data?.default_cadence as PeriodCadence | undefined)
    : undefined;

  return buildTrendMetrics(rows, projectMap, cadence ?? "monthly");
}

export async function getOrgAggregateTrends(orgId: string, range: TrendRange) {
  const db = createAdminClient();
  const since = rangeStart(range);

  const { data: entries } = await db
    .from("time_entries")
    .select(TREND_ENTRY_SELECT)
    .eq("org_id", orgId)
    .gte("entry_date", since);

  const rows = withWrappedHours((entries ?? []) as RawEntryRow[]);
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
  const projectMap = await loadProjects(projectIds);

  const cadence = (await db
    .from("organizations")
    .select("default_cadence")
    .eq("id", orgId)
    .single()).data?.default_cadence as PeriodCadence | undefined;

  return buildTrendMetrics(rows, projectMap, cadence ?? "monthly");
}

export type TrendsBundle = {
  personalTrends: Awaited<ReturnType<typeof getEmployeeTrends>> | null;
  orgAggregateData: Awaited<ReturnType<typeof getOrgAggregateTrends>> | null;
  adminData: Awaited<ReturnType<typeof getAdminTrends>> | null;
};

/**
 * Resolves the full set of trend data for a profile + range (+ optional org for
 * superadmin). Shared by the server page (initial render) and the client
 * `fetchTrendsData` action (in-place filter updates — no navigation).
 */
export async function getTrendsBundle(
  profile: Profile,
  range: TrendRange,
  orgIdParam?: string,
): Promise<TrendsBundle> {
  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const isSuperadmin = profile.role === "superadmin";
  const selectedOrg = isSuperadmin ? orgIdParam?.trim() || undefined : undefined;
  const effectiveOrg = selectedOrg ?? profile.org_id ?? undefined;

  const personalTrends = isSuperadmin ? null : await getEmployeeTrends(profile, range);
  const orgAggregateData =
    isManager && effectiveOrg
      ? await getOrgAggregateTrends(effectiveOrg, range)
      : null;
  const adminData =
    isManager && effectiveOrg ? await getAdminTrends(effectiveOrg, range) : null;

  return { personalTrends, orgAggregateData, adminData };
}

export async function getAdminTrends(orgId: string, range: TrendRange) {
  const db = createAdminClient();
  const since = rangeStart(range);

  const { data: entries } = await db
    .from("time_entries")
    .select(TREND_ENTRY_SELECT)
    .eq("org_id", orgId)
    .gte("entry_date", since);

  const rows = withWrappedHours((entries ?? []) as RawEntryRow[]);
  const employeeIds = [...new Set(rows.map((r) => r.employee_id))];
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];

  const [{ data: profiles }, projectMap] = await Promise.all([
    employeeIds.length
      ? db
          .from("profiles")
          .select("id, full_name, email, rate, rate_type, currency")
          .in("id", employeeIds)
      : Promise.resolve({ data: [] }),
    loadProjects(projectIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  const byEmployee = new Map<
    string,
    {
      name: string;
      hours: number;
      billable: number;
      topProject: string;
      currency: string;
      rate: number | null;
      rateType: string;
    }
  >();

  const projectHoursByEmployee = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const prof = profileMap.get(r.employee_id);
    const name = prof?.full_name?.trim() || prof?.email || "—";
    const cur = byEmployee.get(r.employee_id) ?? {
      name,
      hours: 0,
      billable: 0,
      topProject: "—",
      currency: prof?.currency ?? "USD",
      rate: prof?.rate ?? null,
      rateType: prof?.rate_type ?? "hourly",
    };
    cur.hours += Number(r.total_hours);
    if (r.billable) cur.billable += Number(r.total_hours);

    if (r.project_id) {
      const ph = projectHoursByEmployee.get(r.employee_id) ?? new Map<string, number>();
      ph.set(r.project_id, (ph.get(r.project_id) ?? 0) + Number(r.total_hours));
      projectHoursByEmployee.set(r.employee_id, ph);
    }

    byEmployee.set(r.employee_id, cur);
  }

  for (const [empId, cur] of byEmployee) {
    const ph = projectHoursByEmployee.get(empId);
    if (ph) {
      let topId = "";
      let topH = 0;
      for (const [pid, h] of ph) {
        if (h > topH) {
          topH = h;
          topId = pid;
        }
      }
      cur.topProject = topId ? projectMap.get(topId)?.name ?? "—" : "—";
    }
  }

  const cadence = (await db
    .from("organizations")
    .select("default_cadence")
    .eq("id", orgId)
    .single()).data?.default_cadence as PeriodCadence | undefined;

  const c = cadence ?? "monthly";
  const currentPeriod = periodForDate(toIsoDate(new Date()), c);
  const periods: { label: string; start: string; end: string }[] = [];
  let p = currentPeriod;
  for (let i = 0; i < 8; i++) {
    periods.unshift(p);
    p = shiftPeriod(p, c, -1);
  }

  const employeeNames = new Map<string, string>();
  for (const [id, e] of byEmployee) employeeNames.set(id, e.name);

  const stackedBar = periods.map((period) => {
    const point: Record<string, string | number> = { label: period.label };
    for (const r of rows) {
      if (r.entry_date >= period.start && r.entry_date <= period.end) {
        const key = employeeNames.get(r.employee_id) ?? r.employee_id;
        point[key] = Number(point[key] ?? 0) + Number(r.total_hours);
      }
    }
    return point;
  });

  const stackedEmployees = [...employeeNames.values()];

  return {
    employeeRows: [...byEmployee.values()].map((e) => ({
      ...e,
      billablePct: e.hours ? Math.round((e.billable / e.hours) * 100) : 0,
      earnings: e.rateType === "hourly" && e.rate ? e.billable * e.rate : null,
    })),
    totalHours: rows.reduce((s, r) => s + Number(r.total_hours), 0),
    stackedBar,
    stackedEmployees,
  };
}
