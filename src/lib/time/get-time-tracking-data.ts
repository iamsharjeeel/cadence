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
  labelForDateRange,
  periodForDateByCadence,
  toIsoDate,
  type PeriodCadenceLike,
  weekPeriodFromMonday,
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
const PERSONAL_PERIOD_OPTIONS = [7, 15, 30] as const;

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

export async function ensureTimesheetForWeekForProfile(
  profile: Profile,
  weekMonday: string,
): Promise<
  | { ok: true; timesheetId: string; status: TimesheetStatus }
  | { ok: false; message: string }
> {
  const period = weekPeriodFromMonday(weekMonday);
  const ensured = await ensureTimesheetForPeriodForProfile(profile, {
    anchorDate: weekMonday,
    periodStart: period.start,
    periodEnd: period.end,
  });
  if (!ensured.ok) return ensured;
  return {
    ok: true,
    timesheetId: ensured.timesheetId,
    status: ensured.status,
  };
}

function sanitizePersonalPeriodLength(length?: number): 7 | 15 | 30 {
  if (length && PERSONAL_PERIOD_OPTIONS.includes(length as 7 | 15 | 30)) {
    return length as 7 | 15 | 30;
  }
  return 7;
}

function personalPeriodFromAnchor(
  anchorDate: string,
  personalLengthDays?: number,
) {
  const length = sanitizePersonalPeriodLength(personalLengthDays);
  return {
    start: anchorDate,
    end: addDays(anchorDate, length - 1),
    label: labelForDateRange(anchorDate, addDays(anchorDate, length - 1)),
  };
}

type EnsurePeriodArgs = {
  anchorDate: string;
  periodStart: string;
  periodEnd: string;
};

type ActiveTimesheetRow = {
  id: string;
  status: string;
  period_start: string;
  period_end: string;
  submitted_at: string | null;
  updated_at: string;
  edit_request_status: string | null;
  edit_request_note: string | null;
};

async function ensureTimesheetForPeriodForProfile(
  profile: Profile,
  args: EnsurePeriodArgs,
): Promise<
  | {
      ok: true;
      timesheetId: string;
      status: TimesheetStatus;
      periodStart: string;
      periodEnd: string;
      submittedAt: string | null;
      updatedAt: string;
      editRequestStatus: string | null;
      editRequestNote: string | null;
    }
  | { ok: false; message: string }
> {
  if (!ISO_DATE.test(args.anchorDate)) return { ok: false, message: "Invalid date." };

  const activeOrgId = profile.org_id ?? null;
  const db = createAdminClient();

  let coveringQuery = db
    .from("timesheets")
    .select(
      "id, status, period_start, period_end, submitted_at, updated_at, edit_request_status, edit_request_note",
    )
    .eq("employee_id", profile.id)
    .lte("period_start", args.anchorDate)
    .gte("period_end", args.anchorDate)
    .in("status", ACTIVE_STATUSES);
  coveringQuery = activeOrgId
    ? coveringQuery.eq("org_id", activeOrgId)
    : coveringQuery.is("org_id", null);
  const { data: covering } = await coveringQuery
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (covering) {
    const row = covering as ActiveTimesheetRow;
    return {
      ok: true,
      timesheetId: row.id,
      status: row.status as TimesheetStatus,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      editRequestStatus: row.edit_request_status,
      editRequestNote: row.edit_request_note,
    };
  }

  let existingQuery = db
    .from("timesheets")
    .select(
      "id, status, period_start, period_end, submitted_at, updated_at, edit_request_status, edit_request_note",
    )
    .eq("employee_id", profile.id)
    .eq("period_start", args.periodStart)
    .in("status", ACTIVE_STATUSES);
  existingQuery = activeOrgId
    ? existingQuery.eq("org_id", activeOrgId)
    : existingQuery.is("org_id", null);
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) {
    const row = existing as ActiveTimesheetRow;
    return {
      ok: true,
      timesheetId: row.id,
      status: row.status as TimesheetStatus,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      editRequestStatus: row.edit_request_status,
      editRequestNote: row.edit_request_note,
    };
  }

  const { data: created, error } = await db
    .from("timesheets")
    .insert({
      org_id: activeOrgId as string,
      employee_id: profile.id,
      period_start: args.periodStart,
      period_end: args.periodEnd,
      status: "draft",
      submitted_at: null,
    })
    .select(
      "id, status, period_start, period_end, submitted_at, updated_at, edit_request_status, edit_request_note",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      let retryQuery = db
        .from("timesheets")
        .select(
          "id, status, period_start, period_end, submitted_at, updated_at, edit_request_status, edit_request_note",
        )
        .eq("employee_id", profile.id)
        .eq("period_start", args.periodStart)
        .in("status", ACTIVE_STATUSES);
      retryQuery = activeOrgId
        ? retryQuery.eq("org_id", activeOrgId)
        : retryQuery.is("org_id", null);
      const { data: retry } = await retryQuery.maybeSingle();
      if (retry) {
        const row = retry as ActiveTimesheetRow;
        return {
          ok: true,
          timesheetId: row.id,
          status: row.status as TimesheetStatus,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          submittedAt: row.submitted_at,
          updatedAt: row.updated_at,
          editRequestStatus: row.edit_request_status,
          editRequestNote: row.edit_request_note,
        };
      }
    }
    return { ok: false, message: "Couldn't create timesheet for this period." };
  }

  if (!created) return { ok: false, message: "Couldn't create timesheet for this period." };
  const row = created as ActiveTimesheetRow;

  return {
    ok: true,
    timesheetId: row.id,
    status: row.status as TimesheetStatus,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    editRequestStatus: row.edit_request_status,
    editRequestNote: row.edit_request_note,
  };
}

async function resolveOrgCadence(orgId: string | null): Promise<PeriodCadenceLike> {
  if (!orgId) return "weekly";
  const db = createAdminClient();
  const { data } = await db
    .from("organizations")
    .select("default_cadence")
    .eq("id", orgId)
    .single();
  const cadence = data?.default_cadence;
  return typeof cadence === "string" ? cadence : "weekly";
}

/** Single server-side load for the weekly time log — profile passed in to avoid duplicate auth fetches. */
export async function getTimeTrackingDataForProfile(
  profile: Profile,
  anchorDate: string,
  options?: { personalLengthDays?: number },
): Promise<TimeTrackingResult> {
  const date = ISO_DATE.test(anchorDate) ? anchorDate : toIsoDate(new Date());
  const activeOrgId = profile.org_id ?? null;
  const cadence = await resolveOrgCadence(activeOrgId);
  const targetPeriod = activeOrgId
    ? periodForDateByCadence(date, cadence)
    : personalPeriodFromAnchor(date, options?.personalLengthDays);
  const db = createAdminClient();

  const [ensured, projects, asanaConnected, asanaImportedProjects] = await Promise.all([
    ensureTimesheetForPeriodForProfile(profile, {
      anchorDate: date,
      periodStart: targetPeriod.start,
      periodEnd: targetPeriod.end,
    }),
    fetchProjectsForTimeEntry(activeOrgId, profile.id),
    hasAsanaConnection(profile.id),
    loadAsanaImportedProjects(profile.id),
  ]);
  if (!ensured.ok) return ensured;

  const timesheetId = ensured.timesheetId;
  const period = {
    start: ensured.periodStart,
    end: ensured.periodEnd,
    label: labelForDateRange(ensured.periodStart, ensured.periodEnd),
  };

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
    submittedAt: ensured.submittedAt ?? ensured.updatedAt ?? null,
    editRequestStatus: (ensured.editRequestStatus as "pending" | "approved" | "rejected" | null) ?? null,
    editRequestNote: ensured.editRequestNote ?? null,
    cadence: activeOrgId ? cadence : null,
  };
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
