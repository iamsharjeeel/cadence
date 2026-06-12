import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, isoWeekLabel, weekPeriodFromMonday } from "@/lib/time/periods";
import { weekStatsFromEntries, type WeekStats } from "@/lib/time/week-stats";
import { fetchProjectsForTimeEntry } from "@/app/app/projects/actions";
import type { Profile, TimesheetStatus } from "@/types/db";
import type { Project, TimeEntry, TimeEntryWithProject } from "@/types/time-tracking";

/**
 * Shared, profile-accepting week-load logic. Callers (Server Components and
 * Server Actions) must authenticate the caller themselves via
 * `requireActiveProfile()` and pass the resulting profile in — this module
 * never re-derives identity, so it must not be exposed directly as a Server
 * Action.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_STATUSES: TimesheetStatus[] = ["draft", "submitted", "rejected"];

export type EnsureTimesheetResult =
  | { ok: true; timesheetId: string; status: TimesheetStatus }
  | { ok: false; message: string };

export type TimeTrackingData = {
  ok: true;
  timesheetId: string;
  orgId: string;
  employeeId: string;
  status: TimesheetStatus;
  entries: TimeEntryWithProject[];
  projects: Project[];
  week: ReturnType<typeof weekPeriodFromMonday>;
  isoWeek: string;
  weekStats: WeekStats;
  rate: number | null;
  rateType: string;
  currency: string | null;
};

export type TimeTrackingDataResult = TimeTrackingData | { ok: false; message: string };

/** Link any orphaned (timesheet_id IS NULL) entries in this week's range to the timesheet. */
export async function linkOrphanEntriesToTimesheet(
  timesheetId: string,
  employeeId: string,
  periodStart: string,
  periodEnd: string,
) {
  const db = createAdminClient();
  await db
    .from("time_entries")
    .update({ timesheet_id: timesheetId })
    .eq("employee_id", employeeId)
    .is("timesheet_id", null)
    .gte("entry_date", periodStart)
    .lte("entry_date", periodEnd);
}

/** Fetch-or-create the single active draft timesheet for (employee, week Monday). */
export async function ensureTimesheetForWeekForProfile(
  profile: Profile,
  weekMonday: string,
): Promise<EnsureTimesheetResult> {
  if (!profile.org_id) return { ok: false, message: "Your account has no organization." };
  if (!ISO_DATE.test(weekMonday)) return { ok: false, message: "Invalid week." };

  const periodEnd = addDays(weekMonday, 6);
  const db = createAdminClient();

  const { data: existing } = await db
    .from("timesheets")
    .select("id, status")
    .eq("employee_id", profile.id)
    .eq("period_start", weekMonday)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();

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
      org_id: profile.org_id,
      employee_id: profile.id,
      period_start: weekMonday,
      period_end: periodEnd,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await db
        .from("timesheets")
        .select("id, status")
        .eq("employee_id", profile.id)
        .eq("period_start", weekMonday)
        .in("status", ACTIVE_STATUSES)
        .maybeSingle();
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

function logTiming(label: string, startedAt: number) {
  console.log(`[time-tracking] ${label}: ${Date.now() - startedAt}ms`);
}

/** Full week-load payload for the log view. */
export async function getTimeTrackingDataForProfile(
  profile: Profile,
  weekMonday: string,
): Promise<TimeTrackingDataResult> {
  if (!profile.org_id) return { ok: false, message: "Your account has no organization." };

  const totalStart = Date.now();
  const week = weekPeriodFromMonday(weekMonday);
  const db = createAdminClient();

  const stage1Start = Date.now();
  const [ensured, projects] = await Promise.all([
    ensureTimesheetForWeekForProfile(profile, weekMonday),
    fetchProjectsForTimeEntry(profile.org_id, profile.id),
  ]);
  logTiming("ensureTimesheet + projects", stage1Start);

  if (!ensured.ok) return ensured;
  const timesheetId = ensured.timesheetId;

  const stage2Start = Date.now();
  const [, entriesRes] = await Promise.all([
    linkOrphanEntriesToTimesheet(timesheetId, profile.id, week.start, week.end),
    db
      .from("time_entries")
      .select("*")
      .eq("timesheet_id", timesheetId)
      .order("entry_date")
      .order("start_time"),
  ]);
  logTiming("linkOrphans + entries", stage2Start);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const entries: TimeEntryWithProject[] = ((entriesRes.data ?? []) as TimeEntry[]).map((e) => ({
    ...e,
    project: e.project_id ? projectMap.get(e.project_id) ?? null : null,
  }));

  const weekStats = weekStatsFromEntries(entriesRes.data ?? []);

  logTiming("getTimeTrackingDataForProfile total", totalStart);

  return {
    ok: true,
    timesheetId,
    orgId: profile.org_id,
    employeeId: profile.id,
    status: ensured.status,
    entries,
    projects,
    week,
    isoWeek: isoWeekLabel(weekMonday),
    weekStats,
    rate: profile.rate,
    rateType: profile.rate_type,
    currency: profile.currency,
  };
}
