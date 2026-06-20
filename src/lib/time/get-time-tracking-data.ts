import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProjectsForTimeEntry } from "@/app/app/projects/actions";
import {
  getAsanaConnection,
  hasAsanaConnection,
} from "@/lib/asana/connection";
import {
  addDays,
  isoWeekLabel,
  weekPeriodFromMonday,
  type PayPeriod,
} from "@/lib/time/periods";
import type { WeekStats } from "@/lib/time/week-constants";
import { weekStatsFromEntries } from "@/lib/time/week-stats-from-entries";
import type { Profile, TimesheetStatus } from "@/types/db";
import type { AsanaImportedProject } from "@/types/db";
import type {
  TimeEntry,
  TimeEntryWithProject,
  TimeTrackingData,
} from "@/types/time-tracking";

export type { TimeTrackingData };

export type TimeTrackingResult =
  | TimeTrackingData
  | { ok: false; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_STATUSES: TimesheetStatus[] = ["draft", "submitted", "rejected"];

export async function linkOrphanEntriesToTimesheet(
  timesheetId: string,
  employeeId: string,
  orgId: string | null,
  periodStart: string,
  periodEnd: string,
) {
  const db = createAdminClient();
  let query = db
    .from("time_entries")
    .update({ timesheet_id: timesheetId })
    .eq("employee_id", employeeId)
    .is("timesheet_id", null)
    .gte("entry_date", periodStart)
    .lte("entry_date", periodEnd);
  query = orgId ? query.eq("org_id", orgId) : query.is("org_id", null);
  await query;
}

export async function ensureTimesheetForPeriod(
  profile: Profile,
  periodStart: string,
  periodEnd: string,
): Promise<
  | { ok: true; timesheetId: string; status: TimesheetStatus; submittedAt: string | null }
  | { ok: false; message: string }
> {
  if (!ISO_DATE.test(periodStart) || !ISO_DATE.test(periodEnd)) {
    return { ok: false, message: "Invalid period dates." };
  }

  const activeOrgId = profile.org_id ?? null;
  const db = createAdminClient();

  let existingQuery = db
    .from("timesheets")
    .select("id, status, updated_at")
    .eq("employee_id", profile.id)
    .eq("period_start", periodStart)
    .in("status", ACTIVE_STATUSES as string[]);
  existingQuery = activeOrgId
    ? existingQuery.eq("org_id", activeOrgId)
    : existingQuery.is("org_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const submittedAt =
      (existing.status === "submitted" || existing.status === "approved")
        ? (existing.updated_at as string | null)
        : null;
    return {
      ok: true,
      timesheetId: existing.id,
      status: existing.status as TimesheetStatus,
      submittedAt,
    };
  }

  // Also check approved timesheets (personal locked)
  let approvedQuery = db
    .from("timesheets")
    .select("id, status, updated_at")
    .eq("employee_id", profile.id)
    .eq("period_start", periodStart)
    .eq("status", "approved");
  approvedQuery = activeOrgId
    ? approvedQuery.eq("org_id", activeOrgId)
    : approvedQuery.is("org_id", null);
  const { data: approved } = await approvedQuery.maybeSingle();

  if (approved) {
    return {
      ok: true,
      timesheetId: approved.id,
      status: "approved" as TimesheetStatus,
      submittedAt: approved.updated_at as string | null,
    };
  }

  const { data: created, error } = await db
    .from("timesheets")
    .insert({
      org_id: activeOrgId as string,
      employee_id: profile.id,
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      let retryQuery = db
        .from("timesheets")
        .select("id, status, updated_at")
        .eq("employee_id", profile.id)
        .eq("period_start", periodStart)
        .in("status", [...ACTIVE_STATUSES, "approved"] as string[]);
      retryQuery = activeOrgId
        ? retryQuery.eq("org_id", activeOrgId)
        : retryQuery.is("org_id", null);
      const { data: retry } = await retryQuery.maybeSingle();
      if (retry) {
        return {
          ok: true,
          timesheetId: retry.id,
          status: retry.status as TimesheetStatus,
          submittedAt:
            retry.status === "submitted" || retry.status === "approved"
              ? (retry.updated_at as string | null)
              : null,
        };
      }
    }
    return { ok: false, message: "Couldn't create timesheet for this period." };
  }

  if (!created) return { ok: false, message: "Couldn't create timesheet for this period." };

  return {
    ok: true,
    timesheetId: created.id,
    status: created.status as TimesheetStatus,
    submittedAt: null,
  };
}

export async function ensureTimesheetForWeekForProfile(
  profile: Profile,
  weekMonday: string,
): Promise<
  | { ok: true; timesheetId: string; status: TimesheetStatus; submittedAt: string | null }
  | { ok: false; message: string }
> {
  const periodEnd = addDays(weekMonday, 6);
  return ensureTimesheetForPeriod(profile, weekMonday, periodEnd);
}

async function buildTimeTrackingResult(
  profile: Profile,
  period: PayPeriod,
  ensured: { ok: true; timesheetId: string; status: TimesheetStatus; submittedAt: string | null },
): Promise<TimeTrackingData> {
  const activeOrgId = profile.org_id ?? null;
  const db = createAdminClient();

  const [projects, asanaConnected, asanaImportedProjects] = await Promise.all([
    fetchProjectsForTimeEntry(activeOrgId, profile.id),
    hasAsanaConnection(profile.id),
    loadAsanaImportedProjects(profile.id),
  ]);

  const timesheetId = ensured.timesheetId;

  await linkOrphanEntriesToTimesheet(
    timesheetId,
    profile.id,
    activeOrgId,
    period.start,
    period.end,
  );

  const { data: entryRows } = await db
    .from("time_entries")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .order("entry_date")
    .order("start_time");

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const asanaMap = new Map(asanaImportedProjects.map((p) => [p.id, p]));
  const entries: TimeEntryWithProject[] = ((entryRows ?? []) as TimeEntry[]).map((e) => {
    const asanaProject = e.asana_project_id
      ? asanaMap.get(e.asana_project_id) ?? null
      : null;
    return {
      ...e,
      project: e.project_id ? projectMap.get(e.project_id) ?? null : null,
      asana_project: asanaProject,
      asana_project_name: asanaProject?.asana_project_name ?? null,
    };
  });

  const asanaProjectNamesSyncedAt = asanaConnected
    ? ((await getAsanaConnection(profile.id))?.project_names_synced_at ?? null)
    : null;

  const weekStats = weekStatsFromEntries(entries);

  return {
    ok: true,
    timesheetId,
    orgId: activeOrgId,
    employeeId: profile.id,
    status: ensured.status,
    submittedAt: ensured.submittedAt,
    entries,
    projects,
    asanaConnected,
    asanaImportedProjects,
    asanaProjectNamesSyncedAt,
    week: period,
    isoWeek: isoWeekLabel(period.start),
    weekStats,
    rate: profile.rate,
    rateType: profile.rate_type,
    currency: profile.currency,
  };
}

/** Load time tracking data for a custom period (personal workspace). */
export async function getTimeTrackingDataForPeriodForProfile(
  profile: Profile,
  periodStart: string,
  periodEnd: string,
): Promise<TimeTrackingResult> {
  const period: PayPeriod = {
    start: periodStart,
    end: periodEnd,
    label: `${periodStart} – ${periodEnd}`,
  };

  const [ensured, projects, asanaConnected, asanaImportedProjects] = await Promise.all([
    ensureTimesheetForPeriod(profile, periodStart, periodEnd),
    fetchProjectsForTimeEntry(null, profile.id),
    hasAsanaConnection(profile.id),
    loadAsanaImportedProjects(profile.id),
  ]);
  if (!ensured.ok) return ensured;

  const db = createAdminClient();
  const timesheetId = ensured.timesheetId;

  await linkOrphanEntriesToTimesheet(timesheetId, profile.id, null, periodStart, periodEnd);

  const { data: entryRows } = await db
    .from("time_entries")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .order("entry_date")
    .order("start_time");

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const asanaMap = new Map(asanaImportedProjects.map((p) => [p.id, p]));
  const entries: TimeEntryWithProject[] = ((entryRows ?? []) as TimeEntry[]).map((e) => {
    const asanaProject = e.asana_project_id
      ? asanaMap.get(e.asana_project_id) ?? null
      : null;
    return {
      ...e,
      project: e.project_id ? projectMap.get(e.project_id) ?? null : null,
      asana_project: asanaProject,
      asana_project_name: asanaProject?.asana_project_name ?? null,
    };
  });

  const asanaProjectNamesSyncedAt = asanaConnected
    ? ((await getAsanaConnection(profile.id))?.project_names_synced_at ?? null)
    : null;

  const weekStats = weekStatsFromEntries(entries);

  return {
    ok: true,
    timesheetId,
    orgId: null,
    employeeId: profile.id,
    status: ensured.status,
    submittedAt: ensured.submittedAt,
    entries,
    projects,
    asanaConnected,
    asanaImportedProjects,
    asanaProjectNamesSyncedAt,
    week: period,
    isoWeek: `${periodStart} – ${periodEnd}`,
    weekStats,
    rate: profile.rate,
    rateType: profile.rate_type,
    currency: profile.currency,
  };
}

/** Single server-side load for the weekly time log — profile passed in to avoid duplicate auth fetches. */
export async function getTimeTrackingDataForProfile(
  profile: Profile,
  weekMonday: string,
): Promise<TimeTrackingResult> {
  const week = weekPeriodFromMonday(weekMonday);

  const ensured = await ensureTimesheetForWeekForProfile(profile, weekMonday);
  if (!ensured.ok) return ensured;

  return buildTimeTrackingResult(profile, week, ensured);
}

export async function loadAsanaImportedProjects(
  userId: string,
): Promise<AsanaImportedProject[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("asana_imported_projects")
    .select("*")
    .eq("user_id", userId)
    .order("asana_project_name");

  if (error) {
    console.error("[time-tracking] asana imported projects:", error.message);
    return [];
  }
  return (data ?? []) as AsanaImportedProject[];
}
