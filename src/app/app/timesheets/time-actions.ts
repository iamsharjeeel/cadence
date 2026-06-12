"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins } from "@/lib/notifications";
import {
  addDays,
  isoWeekLabel,
  mondayOfWeek,
  toIsoDate,
  weekPeriodFromMonday,
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
import { fetchProjectsForTimeEntry } from "@/app/app/projects/actions";
import type { Project, TimeEntry, TimeEntryWithProject } from "@/types/time-tracking";

export type ActionResult = { ok: boolean; message: string; id?: string };

export type SaveEntryResult = ActionResult & { weekStats?: WeekStats };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_STATUSES: TimesheetStatus[] = ["draft", "submitted", "rejected"];

function editableStatus(status: TimesheetStatus): boolean {
  return status === "draft" || status === "rejected";
}

async function linkOrphanEntriesToTimesheet(
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
export async function ensureTimesheetForWeek(
  weekMonday: string,
): Promise<{ ok: true; timesheetId: string; status: TimesheetStatus } | ActionResult> {
  const profile = await requireActiveProfile();
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
  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  return {
    ok: true,
    timesheetId: created.id,
    status: created.status as TimesheetStatus,
  };
}

export async function getTimeTrackingData(weekMonday: string): Promise<
  | {
      ok: true;
      timesheetId: string;
      orgId: string;
      employeeId: string;
      status: TimesheetStatus;
      rejection_note: string | null;
      entries: TimeEntryWithProject[];
      projects: Project[];
      week: ReturnType<typeof weekPeriodFromMonday>;
      isoWeek: string;
      weekStats: WeekStats;
      rate: number | null;
      rateType: string;
      currency: string | null;
    }
  | ActionResult
> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "Your account has no organization." };

  const week = weekPeriodFromMonday(weekMonday);
  const db = createAdminClient();

  const [ensured, projects] = await Promise.all([
    ensureTimesheetForWeek(weekMonday),
    fetchProjectsForTimeEntry(profile.org_id, profile.id),
  ]);
  if (!ensured.ok) return ensured;
  if (!("timesheetId" in ensured)) return ensured;

  const timesheetId = ensured.timesheetId;

  const [, entriesRes, weekStats, tsDetails] = await Promise.all([
    linkOrphanEntriesToTimesheet(
      timesheetId,
      profile.id,
      week.start,
      week.end,
    ),
    db
      .from("time_entries")
      .select("*")
      .eq("timesheet_id", timesheetId)
      .order("entry_date")
      .order("start_time"),
    computeWeekStats(timesheetId),
    db.from("timesheets").select("rejection_note").eq("id", timesheetId).single(),
  ]);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const entries: TimeEntryWithProject[] = ((entriesRes.data ?? []) as TimeEntry[]).map(
    (e) => ({
      ...e,
      project: e.project_id ? projectMap.get(e.project_id) ?? null : null,
    }),
  );

  return {
    ok: true,
    timesheetId,
    orgId: profile.org_id,
    employeeId: profile.id,
    status: ensured.status,
    rejection_note: tsDetails.data?.rejection_note ?? null,
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
  if (!profile.org_id) return { ok: false, message: "Your account has no organization." };
  if (!payload.timesheetId) {
    return { ok: false, message: "Timesheet not ready — refresh and try again." };
  }

  const validated = validateEntryPayload(payload);
  if (!validated.ok || !("start" in validated)) return validated;

  const guard = await assertEditableTimesheet(payload.timesheetId, profile.id);
  if (!guard.ok) return guard;

  const overlap = await checkOverlap(
    profile.id,
    payload.entryDate,
    validated.start,
    validated.end,
    validated.overnight,
    payload.id,
  );
  if (overlap) return { ok: false, message: overlap };

  const db = createAdminClient();
  const projectId =
    payload.projectId && payload.projectId.trim() !== ""
      ? payload.projectId
      : null;

  const row = {
    org_id: profile.org_id,
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

export async function submitTimesheetForApproval(
  timesheetId: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "Your account has no organization." };

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("*")
    .eq("id", timesheetId)
    .single();
  if (!ts || ts.employee_id !== profile.id) {
    return { ok: false, message: "Timesheet not found." };
  }
  if (!editableStatus(ts.status as TimesheetStatus)) {
    return { ok: false, message: "This timesheet can't be submitted." };
  }

  await linkOrphanEntriesToTimesheet(
    timesheetId,
    profile.id,
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
    orgId: profile.org_id,
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
    orgId: profile.org_id,
    type: "timesheet_submitted",
    title: "New timesheet submitted",
    body: `${employeeName} · ${ts.period_start} – ${ts.period_end}${hasOvertime ? ` · Overtime +${otHours}h` : ""}`,
    entity: "timesheets",
    entityId: timesheetId,
    excludeUserId: profile.id,
  });

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  revalidatePath("/app/dashboard");
  return { ok: true, message: "Timesheet submitted for approval." };
}

export async function checkTimeLogReminder(): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) {
    return { ok: true, message: "" };
  }

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
    org_id: profile.org_id,
    user_id: profile.id,
    type: "time_log_reminder",
    title: "Log your time",
    body: `You haven't logged time in the last 3 days (${week.label}).`,
    entity: "timesheets",
  });

  return { ok: true, message: "Reminder sent." };
}

// ---------------------------------------------------------------------------
// Manager week overview
// ---------------------------------------------------------------------------

export type WeekOverviewRow = {
  employeeId: string;
  employeeName: string;
  avatarInitials: string;
  timesheetId: string | null;
  status: TimesheetStatus | "none";
  totalHours: number;
  resubmitCount: number;
};

export async function getWeekOverview(weekMonday: string): Promise<
  | { ok: true; rows: WeekOverviewRow[]; weekLabel: string }
  | { ok: false; message: string }
> {
  const profile = await requireActiveProfile();

  const isManager =
    profile.role === "admin" ||
    profile.role === "superadmin" ||
    (profile.role as string) === "owner";
  if (!isManager) return { ok: false, message: "Not authorized." };

  // Superadmin without an org sees an empty list (org filter handles selection)
  if (!profile.org_id) {
    return {
      ok: true,
      rows: [],
      weekLabel: weekPeriodFromMonday(weekMonday).label,
    };
  }

  const org_id = profile.org_id;
  const weekEnd = addDays(weekMonday, 6);
  const weekLabel = weekPeriodFromMonday(weekMonday).label;

  const db = createAdminClient();

  // Fetch all active employees in the org
  const { data: people, error: peopleError } = await db
    .from("profiles")
    .select("id, full_name, email, status")
    .eq("org_id", org_id)
    .eq("status", "active");
  if (peopleError) return { ok: false, message: peopleError.message };

  // Fetch timesheets for this week
  const { data: timesheets } = await db
    .from("timesheets")
    .select("id, employee_id, status, rejection_note, resubmit_count")
    .eq("org_id", org_id)
    .eq("period_start", weekMonday);

  // Fetch time_entries hours for this week
  const { data: entries } = await db
    .from("time_entries")
    .select("employee_id, total_hours")
    .eq("org_id", org_id)
    .gte("entry_date", weekMonday)
    .lte("entry_date", weekEnd);

  // Build lookup maps
  const timesheetByEmployee = new Map<
    string,
    { id: string; status: string; resubmitCount: number }
  >();
  for (const ts of timesheets ?? []) {
    timesheetByEmployee.set(ts.employee_id, {
      id: ts.id,
      status: ts.status,
      resubmitCount:
        ((ts as Record<string, unknown>).resubmit_count as number) ?? 0,
    });
  }

  const hoursByEmployee = new Map<string, number>();
  for (const e of entries ?? []) {
    hoursByEmployee.set(
      e.employee_id,
      (hoursByEmployee.get(e.employee_id) ?? 0) + (e.total_hours ?? 0),
    );
  }

  // Build rows
  const { initials } = await import("@/lib/utils");
  const rows: WeekOverviewRow[] = (people ?? []).map((p) => {
    const ts = timesheetByEmployee.get(p.id);
    const employeeName = (p.full_name as string | null)?.trim() || p.email;
    return {
      employeeId: p.id,
      employeeName,
      avatarInitials: initials(p.full_name as string | null, p.email),
      timesheetId: ts?.id ?? null,
      status: ts ? (ts.status as TimesheetStatus) : "none",
      totalHours: hoursByEmployee.get(p.id) ?? 0,
      resubmitCount: ts?.resubmitCount ?? 0,
    };
  });

  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return { ok: true, rows, weekLabel };
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
    ((profile.role === "admin" || profile.role === "owner") && ts.org_id === profile.org_id);
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
