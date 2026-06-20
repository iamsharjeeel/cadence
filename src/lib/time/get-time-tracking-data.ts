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
  viewPeriodForDate,
  type ViewPeriodCadence,
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

type EnsuredTimesheet = {
  ok: true;
  timesheetId: string;
  status: TimesheetStatus;
  submittedAt: string | null;
};

function submittedAtFromRow(status: string, updatedAt: string | null): string | null {
  return status === "submitted" || status === "approved" ? updatedAt : null;
}

export async function ensureTimesheetForViewPeriod(
  profile: Profile,
  anchorDate: string,
  viewCadence: ViewPeriodCadence = "weekly",
): Promise<EnsuredTimesheet | { ok: false; message: string }> {
  if (!ISO_DATE.test(anchorDate)) return { ok: false, message: "Invalid period." };

  const period = viewPeriodForDate(anchorDate, viewCadence);
  const activeOrgId = profile.org_id ?? null;
  const db = createAdminClient();

  let existingQuery = db
    .from("timesheets")
    .select("id, status, updated_at")
    .eq("employee_id", profile.id)
    .eq("period_start", period.start)
    .in("status", ACTIVE_STATUSES);
  existingQuery = activeOrgId
    ? existingQuery.eq("org_id", activeOrgId)
    : existingQuery.is("org_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    return {
      ok: true,
      timesheetId: existing.id,
      status: existing.status as TimesheetStatus,
      submittedAt: submittedAtFromRow(
        existing.status,
        existing.updated_at as string | null,
      ),
    };
  }

  // Personal locked timesheets (self-approved after edit window)
  if (!activeOrgId) {
    const { data: approved } = await db
      .from("timesheets")
      .select("id, status, updated_at")
      .eq("employee_id", profile.id)
      .eq("period_start", period.start)
      .is("org_id", null)
      .eq("status", "approved")
      .maybeSingle();

    if (approved) {
      return {
        ok: true,
        timesheetId: approved.id,
        status: "approved",
        submittedAt: approved.updated_at as string | null,
      };
    }
  }

  const { data: created, error } = await db
    .from("timesheets")
    .insert({
      org_id: activeOrgId as string,
      employee_id: profile.id,
      period_start: period.start,
      period_end: period.end,
      status: "draft",
    })
    .select("id, status, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      let retryQuery = db
        .from("timesheets")
        .select("id, status, updated_at")
        .eq("employee_id", profile.id)
        .eq("period_start", period.start)
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
          submittedAt: submittedAtFromRow(
            retry.status,
            retry.updated_at as string | null,
          ),
        };
      }
    }
    return { ok: false, message: "Couldn't create timesheet for this period." };
  }

  if (!created) {
    return { ok: false, message: "Couldn't create timesheet for this period." };
  }

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
  | { ok: true; timesheetId: string; status: TimesheetStatus }
  | { ok: false; message: string }
> {
  if (!ISO_DATE.test(weekMonday)) return { ok: false, message: "Invalid week." };

  const activeOrgId = profile.org_id ?? null;
  const periodEnd = addDays(weekMonday, 6);
  const db = createAdminClient();

  let existingQuery = db
    .from("timesheets")
    .select("id, status")
    .eq("employee_id", profile.id)
    .eq("period_start", weekMonday)
    .in("status", ACTIVE_STATUSES);
  existingQuery = activeOrgId
    ? existingQuery.eq("org_id", activeOrgId)
    : existingQuery.is("org_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    return {
      ok: true,
      timesheetId: existing.id,
      status: existing.status as TimesheetStatus,
    };
  }

  const { data: created, error } = await db
    .from("timesheets")
    .insert({
      org_id: activeOrgId as string,
      employee_id: profile.id,
      period_start: weekMonday,
      period_end: periodEnd,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      let retryQuery = db
        .from("timesheets")
        .select("id, status")
        .eq("employee_id", profile.id)
        .eq("period_start", weekMonday)
        .in("status", ACTIVE_STATUSES);
      retryQuery = activeOrgId
        ? retryQuery.eq("org_id", activeOrgId)
        : retryQuery.is("org_id", null);
      const { data: retry } = await retryQuery.maybeSingle();
      if (retry) {
        return {
          ok: true,
          timesheetId: retry.id,
          status: retry.status as TimesheetStatus,
        };
      }
    }
    return { ok: false, message: "Couldn't create timesheet for this week." };
  }

  if (!created) return { ok: false, message: "Couldn't create timesheet for this week." };

  return {
    ok: true,
    timesheetId: created.id,
    status: created.status as TimesheetStatus,
  };
}

/** Single server-side load for the time log — profile passed in to avoid duplicate auth fetches. */
export async function getTimeTrackingDataForProfile(
  profile: Profile,
  anchorDate: string,
  viewCadence: ViewPeriodCadence = "weekly",
): Promise<TimeTrackingResult> {
  const activeOrgId = profile.org_id ?? null;
  const week = viewPeriodForDate(anchorDate, viewCadence);
  const db = createAdminClient();

  const [ensured, projects, asanaConnected, asanaImportedProjects] = await Promise.all([
    ensureTimesheetForViewPeriod(profile, anchorDate, viewCadence),
    fetchProjectsForTimeEntry(activeOrgId, profile.id),
    hasAsanaConnection(profile.id),
    loadAsanaImportedProjects(profile.id),
  ]);
  if (!ensured.ok) return ensured;

  const timesheetId = ensured.timesheetId;

  await linkOrphanEntriesToTimesheet(
    timesheetId,
    profile.id,
    activeOrgId,
    week.start,
    week.end,
  );

  const { data: entryRows } = await db
    .from("time_entries")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .order("entry_date")
    .order("start_time");

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const asanaMap = new Map(asanaImportedProjects.map((p) => [p.id, p]));
  const entries: TimeEntryWithProject[] = ((entryRows ?? []) as TimeEntry[]).map(
    (e) => {
      const asanaProject = e.asana_project_id
        ? asanaMap.get(e.asana_project_id) ?? null
        : null;
      return {
        ...e,
        project: e.project_id ? projectMap.get(e.project_id) ?? null : null,
        asana_project: asanaProject,
        asana_project_name: asanaProject?.asana_project_name ?? null,
      };
    },
  );

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
    week,
    isoWeek: isoWeekLabel(week.start),
    weekStats,
    rate: profile.rate,
    rateType: profile.rate_type,
    currency: profile.currency,
  };
}

/** @deprecated alias — weekly anchor date */
export async function getTimeTrackingDataForWeek(
  profile: Profile,
  weekMonday: string,
): Promise<TimeTrackingResult> {
  return getTimeTrackingDataForProfile(profile, weekMonday, "weekly");
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
