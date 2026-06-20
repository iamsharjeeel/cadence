"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins } from "@/lib/notifications";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import {
  addDays,
  isoWeekLabel,
  mondayOfWeek,
  shiftViewPeriod,
  toIsoDate,
  viewPeriodForDate,
  weekPeriodFromMonday,
  type ViewPeriodCadence,
} from "@/lib/time/periods";
import {
  canSubmitWeek,
  computeWeekStats,
  overtimeHours,
  type WeekStats,
} from "@/lib/time/week-stats";
import {
  hoursBetween,
  isOvernightShift,
  parseTime,
  rangesOverlap,
  toRange,
} from "@/lib/time/validation";
import type { TimesheetStatus } from "@/types/db";
import {
  ensureTimesheetForWeekForProfile,
  ensureTimesheetForViewPeriod,
  getTimeTrackingDataForProfile,
  linkOrphanEntriesToTimesheet,
} from "@/lib/time/get-time-tracking-data";
import type { TimeEntry, TimeEntryWithProject } from "@/types/time-tracking";

export type ActionResult = { ok: boolean; message: string; id?: string };

export type SaveEntryResult = ActionResult & { weekStats?: WeekStats };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_STATUSES: TimesheetStatus[] = ["draft", "submitted", "rejected"];

function editableStatus(status: TimesheetStatus): boolean {
  return status === "draft" || status === "submitted" || status === "rejected";
}

/** Fetch-or-create the single active draft timesheet for (employee, week Monday). */
export async function ensureTimesheetForWeek(
  weekMonday: string,
): Promise<{ ok: true; timesheetId: string; status: TimesheetStatus } | ActionResult> {
  const profile = await requireActiveProfile();
  const hadTimesheet = await createAdminClient()
    .from("timesheets")
    .select("id")
    .eq("employee_id", profile.id)
    .eq("period_start", weekMonday)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();

  const result = await ensureTimesheetForWeekForProfile(profile, weekMonday);
  if (result.ok && !hadTimesheet.data) {
    revalidatePath("/app/timesheets");
    revalidatePath("/app/timesheets/log");
  }
  return result;
}

export async function getTimeTrackingData(
  anchorDate: string,
  viewCadence?: import("@/lib/time/periods").ViewPeriodCadence,
) {
  const profile = await requireActiveProfile();
  return getTimeTrackingDataForProfile(profile, anchorDate, viewCadence ?? "weekly");
}

async function assertEditableTimesheet(timesheetId: string, employeeId: string) {
  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, status, employee_id, org_id")
    .eq("id", timesheetId)
    .single();
  if (!ts) return { ok: false as const, message: "Timesheet not found." };
  if (ts.employee_id !== employeeId) {
    return { ok: false as const, message: "Not authorized." };
  }
  if (!editableStatus(ts.status as TimesheetStatus)) {
    return { ok: false as const, message: "This timesheet is locked." };
  }
  return { ok: true as const, ts };
}

async function checkOverlap(
  employeeId: string,
  entryDate: string,
  startTime: string,
  endTime: string,
  overnight: boolean,
  excludeId?: string,
): Promise<string | null> {
  const range = toRange(startTime, endTime, overnight);
  if (!range) return "Invalid time range.";

  const db = createAdminClient();
  const { data: siblings } = await db
    .from("time_entries")
    .select("id, start_time, end_time")
    .eq("employee_id", employeeId)
    .eq("entry_date", entryDate);

  for (const s of siblings ?? []) {
    if (excludeId && s.id === excludeId) continue;
    const otherStart = String(s.start_time).slice(0, 5);
    const otherEnd = String(s.end_time).slice(0, 5);
    const other = toRange(
      otherStart,
      otherEnd,
      isOvernightShift(otherStart, otherEnd),
    );
    if (other && rangesOverlap(range, other)) {
      return "This entry overlaps another on the same day.";
    }
  }
  return null;
}

type EntryPayload = {
  timesheetId: string;
  entryDate: string;
  startTime: string;
  endTime: string;
  overnight?: boolean;
  projectId?: string | null;
  description?: string;
  billable?: boolean;
};

function validateEntryPayload(payload: EntryPayload): {
  ok: true;
  start: string;
  end: string;
  overnight: boolean;
} | ActionResult {
  if (!ISO_DATE.test(payload.entryDate)) {
    return { ok: false, message: "Invalid date." };
  }
  const start = parseTime(payload.startTime);
  const end = parseTime(payload.endTime);
  if (!start) return { ok: false, message: "Start time is required." };
  if (!end) return { ok: false, message: "End time is required." };

  const overnight = Boolean(payload.overnight) || isOvernightShift(start, end);
  if (!overnight && end <= start) {
    return { ok: false, message: "End time must be after start time." };
  }

  const hours = hoursBetween(start, end, overnight);
  if (hours === null || hours <= 0 || hours > 24) {
    return { ok: false, message: "Invalid time range." };
  }

  return { ok: true, start, end, overnight };
}

export async function upsertTimeEntry(
  payload: EntryPayload & { id?: string },
): Promise<SaveEntryResult> {
  const profile = await requireActiveProfile();
  const activeOrgId = profile.org_id ?? null;
  if (!payload.timesheetId) {
    return { ok: false, message: "Timesheet not ready — refresh and try again." };
  }

  const validated = validateEntryPayload(payload);
  if (!validated.ok || !("start" in validated)) return validated;

  const guard = await assertEditableTimesheet(payload.timesheetId, profile.id);
  if (!guard.ok) return guard;

  if (!validated.overnight) {
    const overlap = await checkOverlap(
      profile.id,
      payload.entryDate,
      validated.start,
      validated.end,
      validated.overnight,
      payload.id,
    );
    if (overlap) return { ok: false, message: overlap };
  }

  const db = createAdminClient();
  const projectId =
    payload.projectId && payload.projectId.trim() !== ""
      ? payload.projectId
      : null;

  // NOTE: `is_overnight` is NOT a live `time_entries` column. Overnight is
  // derived locally (validated.overnight) for overlap skipping only — never
  // written to the DB. `total_hours` is a GENERATED column and likewise omitted.
  const row = {
    org_id: activeOrgId as string,
    employee_id: profile.id,
    timesheet_id: payload.timesheetId,
    project_id: projectId,
    entry_date: payload.entryDate,
    start_time: validated.start,
    end_time: validated.end,
    description: payload.description?.trim() || null,
    billable: payload.billable ?? true,
  };

  if (payload.id) {
    const { error } = await db
      .from("time_entries")
      .update({
        timesheet_id: row.timesheet_id,
        project_id: row.project_id,
        entry_date: row.entry_date,
        start_time: row.start_time,
        end_time: row.end_time,
        description: row.description,
        billable: row.billable,
      })
      .eq("id", payload.id)
      .eq("employee_id", profile.id);
    if (error) return { ok: false, message: error.message ?? "Couldn't save entry." };
  } else {
    const { data, error } = await db
      .from("time_entries")
      .insert(row)
      .select("id, total_hours")
      .single();
    if (error || !data) {
      return {
        ok: false,
        message: error?.message ?? "Couldn't create entry.",
      };
    }
    payload.id = data.id;
  }

  const stats = await computeWeekStats(payload.timesheetId);
  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  return {
    ok: true,
    message: "Saved.",
    id: payload.id,
    weekStats: stats,
  };
}

export async function deleteTimeEntry(id: string): Promise<SaveEntryResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();
  const { data: entry } = await db
    .from("time_entries")
    .select("timesheet_id, employee_id")
    .eq("id", id)
    .single();
  if (!entry || entry.employee_id !== profile.id) {
    return { ok: false, message: "Entry not found." };
  }
  const guard = await assertEditableTimesheet(entry.timesheet_id!, profile.id);
  if (!guard.ok) return guard;

  const { error } = await db.from("time_entries").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't delete entry." };

  const stats = await computeWeekStats(entry.timesheet_id!);
  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  return { ok: true, message: "Deleted.", weekStats: stats };
}

/** Marks a personal (no-org) timesheet as submitted / self-approved. */
export async function submitPersonalTimesheet(
  timesheetId: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, org_id, employee_id, status, period_start, period_end")
    .eq("id", timesheetId)
    .single();
  if (!ts || ts.employee_id !== profile.id) {
    return { ok: false, message: "Timesheet not found." };
  }
  if (ts.org_id) {
    return { ok: false, message: "Use submitTimesheetForApproval for org timesheets." };
  }
  if (!editableStatus(ts.status as TimesheetStatus)) {
    return { ok: false, message: "This timesheet can't be submitted." };
  }

  const { error } = await db
    .from("timesheets")
    .update({
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", timesheetId);
  if (error) return { ok: false, message: "Couldn't submit timesheet." };

  await writeAudit({
    actorId: profile.id,
    orgId: null,
    action: "timesheet_submitted",
    entity: "timesheets",
    payload: {
      timesheet_id: timesheetId,
      period_start: ts.period_start,
      period_end: ts.period_end,
      personal: true,
    },
  });

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  return { ok: true, message: "Timesheet submitted." };
}

/** Locks a submitted personal timesheet (self-approved after edit window). */
export async function lockPersonalTimesheet(
  timesheetId: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, org_id, employee_id, status")
    .eq("id", timesheetId)
    .single();
  if (!ts || ts.employee_id !== profile.id || ts.org_id) {
    return { ok: false, message: "Not found." };
  }
  if (ts.status !== "submitted") {
    return { ok: false, message: "Only submitted timesheets can be locked." };
  }
  const { error } = await db
    .from("timesheets")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .eq("id", timesheetId);
  if (error) return { ok: false, message: "Couldn't lock timesheet." };
  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  return { ok: true, message: "Timesheet locked." };
}

/** Stores a "request edit" note on an approved personal timesheet. */
export async function requestPersonalTimesheetEdit(
  timesheetId: string,
  note: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!note.trim()) return { ok: false, message: "An explanation is required." };
  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, org_id, employee_id, status")
    .eq("id", timesheetId)
    .single();
  if (!ts || ts.employee_id !== profile.id || ts.org_id) {
    return { ok: false, message: "Not found." };
  }
  if (ts.status !== "approved") {
    return { ok: false, message: "Only locked timesheets can have edit requests." };
  }
  await writeAudit({
    actorId: profile.id,
    orgId: null,
    action: "timesheet_edit_requested",
    entity: "timesheets",
    payload: { timesheet_id: timesheetId, note: note.trim() },
  });
  return { ok: true, message: "Edit request logged." };
}

export async function submitTimesheetForApproval(
  timesheetId: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("*")
    .eq("id", timesheetId)
    .single();
  if (!ts || ts.employee_id !== profile.id) {
    return { ok: false, message: "Timesheet not found." };
  }
  if (!ts.org_id) {
    return {
      ok: false,
      message: "Use submitPersonalTimesheet for personal timesheets.",
    };
  }
  if (!editableStatus(ts.status as TimesheetStatus)) {
    return { ok: false, message: "This timesheet can't be submitted." };
  }

  await linkOrphanEntriesToTimesheet(
    timesheetId,
    profile.id,
    ts.org_id,
    ts.period_start,
    ts.period_end,
  );

  const stats = await computeWeekStats(timesheetId);
  if (!canSubmitWeek(stats.daysLogged, stats.totalHours)) {
    return {
      ok: false,
      message: `Submit requires at least 5 days logged or 40 hours (currently ${stats.daysLogged} days · ${stats.totalHours.toFixed(1)}h).`,
    };
  }

  const hasOvertime = stats.totalHours > 40;
  const otHours = overtimeHours(stats.totalHours);

  const { error } = await db
    .from("timesheets")
    .update({
      status: "submitted",
      has_overtime: hasOvertime,
      overtime_hours: hasOvertime ? otHours : 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", timesheetId);
  if (error) return { ok: false, message: "Couldn't submit timesheet." };

  const employeeName = profile.full_name?.trim() || profile.email;
  await writeAudit({
    actorId: profile.id,
    orgId: ts.org_id,
    action: "timesheet_submitted",
    entity: "timesheets",
    payload: {
      timesheet_id: timesheetId,
      period_start: ts.period_start,
      period_end: ts.period_end,
      days_logged: stats.daysLogged,
      total_hours: stats.totalHours,
      has_overtime: hasOvertime,
      overtime_hours: otHours,
    },
  });

  await notifyOrgAdmins({
    orgId: ts.org_id,
    type: "timesheet_submitted",
    title: "New timesheet submitted",
    body: `${employeeName} · ${ts.period_start} – ${ts.period_end}${hasOvertime ? ` · Overtime +${otHours}h` : ""}`,
    entity: "timesheets",
    entityId: timesheetId,
    excludeUserId: profile.id,
  });

  void dispatchWebhookEvent(ts.org_id, {
    type: "timesheet.submitted",
    data: {
      timesheet_id: timesheetId,
      employee_id: profile.id,
      org_id: ts.org_id,
      period_start: ts.period_start,
      period_end: ts.period_end,
      days_logged: stats.daysLogged,
      total_hours: stats.totalHours,
      has_overtime: hasOvertime,
      overtime_hours: otHours,
    },
  });

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  revalidatePath("/app/dashboard");
  return { ok: true, message: "Timesheet submitted for approval." };
}

export async function checkTimeLogReminder(): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const activeOrgId = profile.org_id ?? null;

  const today = toIsoDate(new Date());
  const weekMonday = mondayOfWeek(today);
  const week = weekPeriodFromMonday(weekMonday);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const since = toIsoDate(threeDaysAgo);

  const db = createAdminClient();
  const { data: recent } = await db
    .from("time_entries")
    .select("id")
    .eq("employee_id", profile.id)
    .gte("entry_date", since)
    .limit(1);

  if (recent && recent.length > 0) return { ok: true, message: "" };

  const { data: existing } = await db
    .from("notifications")
    .select("id")
    .eq("user_id", profile.id)
    .eq("type", "time_log_reminder")
    .gte("created_at", `${since}T00:00:00Z`)
    .limit(1);
  if (existing && existing.length > 0) return { ok: true, message: "" };

  await db.from("notifications").insert({
    org_id: activeOrgId as string,
    user_id: profile.id,
    type: "time_log_reminder",
    title: "Log your time",
    body: `You haven't logged time in the last 3 days (${week.label}).`,
    entity: "timesheets",
  });

  return { ok: true, message: "Reminder sent." };
}

/** Copy all time entries from the previous period into the current draft period (date-shifted). */
export async function copyEntriesFromPreviousPeriod(
  anchorDate: string,
  viewCadence: ViewPeriodCadence,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (profile.org_id) {
    return { ok: false, message: "Only available in personal workspace." };
  }

  const currentPeriod = viewPeriodForDate(anchorDate, viewCadence);
  const previousPeriod = shiftViewPeriod(currentPeriod, viewCadence, -1);
  const db = createAdminClient();

  const { data: fromTs } = await db
    .from("timesheets")
    .select("id")
    .eq("employee_id", profile.id)
    .eq("period_start", previousPeriod.start)
    .is("org_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fromTs) return { ok: false, message: "No previous period timesheet found." };

  const { data: fromEntries } = await db
    .from("time_entries")
    .select("*")
    .eq("timesheet_id", fromTs.id)
    .order("entry_date")
    .order("start_time");

  if (!fromEntries || fromEntries.length === 0) {
    return { ok: false, message: "No entries to copy from previous period." };
  }

  const toTs = await ensureTimesheetForViewPeriod(profile, anchorDate, viewCadence);
  if (!toTs.ok) return { ok: false, message: toTs.message };
  if (toTs.status !== "draft") {
    return { ok: false, message: "Current period timesheet is not editable." };
  }

  const dateDelta =
    (new Date(currentPeriod.start).getTime() -
      new Date(previousPeriod.start).getTime()) /
    86_400_000;

  const inserts = (fromEntries as TimeEntry[])
    .map((e) => {
      const originalDate = new Date(e.entry_date);
      originalDate.setDate(originalDate.getDate() + dateDelta);
      const newDate = originalDate.toISOString().slice(0, 10);
      if (newDate < currentPeriod.start || newDate > currentPeriod.end) return null;
      return {
        employee_id: profile.id,
        org_id: null as string | null,
        timesheet_id: toTs.timesheetId,
        entry_date: newDate,
        entry_mode: e.entry_mode,
        start_time: e.start_time,
        end_time: e.end_time,
        decimal_hours: e.decimal_hours,
        project_id: e.project_id,
        asana_project_id: e.asana_project_id,
        description: e.description,
        billable: e.billable,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (inserts.length === 0) {
    return { ok: false, message: "No entries fell within the new period." };
  }

  const { error } = await db.from("time_entries").insert(inserts);
  if (error) return { ok: false, message: "Failed to copy entries." };

  revalidatePath("/app/timesheets/log");
  return {
    ok: true,
    message: `Copied ${inserts.length} entr${inserts.length === 1 ? "y" : "ies"} from previous period.`,
  };
}

export async function getTimesheetEntriesReadOnly(
  timesheetId: string,
): Promise<
  | { ok: true; entries: TimeEntryWithProject[]; status: TimesheetStatus }
  | ActionResult
> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("org_id, employee_id, status")
    .eq("id", timesheetId)
    .single();
  if (!ts) return { ok: false, message: "Timesheet not found." };

  const allowed =
    profile.role === "superadmin" ||
    ts.employee_id === profile.id ||
    (profile.role === "admin" &&
      profile.org_id != null &&
      ts.org_id === profile.org_id);
  if (!allowed) return { ok: false, message: "Not authorized." };

  const { data } = await db
    .from("time_entries")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .order("entry_date")
    .order("start_time");

  const raw = (data ?? []) as TimeEntry[];
  const { data: projects } = await db
    .from("projects")
    .select("id, name, color")
    .in("id", raw.map((e) => e.project_id).filter(Boolean) as string[]);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));

  return {
    ok: true,
    entries: raw.map((e) => ({
      ...e,
      project: e.project_id ? projectMap.get(e.project_id) ?? null : null,
    })) as TimeEntryWithProject[],
    status: ts.status as TimesheetStatus,
  };
}
