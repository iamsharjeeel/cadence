"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins } from "@/lib/notifications";
import { periodForDate, toIsoDate } from "@/lib/time/periods";
import {
  hoursBetween,
  isOvernightShift,
  parseTime,
  rangesOverlap,
  toRange,
} from "@/lib/time/validation";
import type { PeriodCadence, TimesheetStatus } from "@/types/db";
import type { Project, TimeEntry, TimeEntryWithProject } from "@/types/time-tracking";

export type ActionResult = { ok: boolean; message: string; id?: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function editableStatus(status: TimesheetStatus): boolean {
  return status === "draft" || status === "rejected";
}

async function getOrgCadence(orgId: string): Promise<PeriodCadence> {
  const db = createAdminClient();
  const { data } = await db
    .from("organizations")
    .select("default_cadence")
    .eq("id", orgId)
    .single();
  return (data?.default_cadence as PeriodCadence) ?? "monthly";
}

export async function ensureTimesheetForPeriod(
  periodStart: string,
  periodEnd: string,
): Promise<{ ok: true; timesheetId: string; status: TimesheetStatus } | ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "Your account has no organization." };
  if (!ISO_DATE.test(periodStart) || !ISO_DATE.test(periodEnd)) {
    return { ok: false, message: "Invalid period." };
  }

  const db = createAdminClient();
  const { data: existing } = await db
    .from("timesheets")
    .select("id, status")
    .eq("employee_id", profile.id)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
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
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
    })
    .select("id, status")
    .single();

  if (error || !created) return { ok: false, message: "Couldn't create timesheet period." };
  revalidatePath("/app/timesheets");
  return {
    ok: true,
    timesheetId: created.id,
    status: created.status as TimesheetStatus,
  };
}

export async function getTimeTrackingData(
  periodStart: string,
  periodEnd: string,
): Promise<
  | {
      ok: true;
      timesheetId: string;
      status: TimesheetStatus;
      entries: TimeEntryWithProject[];
      projects: Project[];
      cadence: PeriodCadence;
      rate: number | null;
      rateType: string;
      currency: string | null;
    }
  | ActionResult
> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "Your account has no organization." };

  const ensured = await ensureTimesheetForPeriod(periodStart, periodEnd);
  if (!ensured.ok) return ensured;
  if (!("timesheetId" in ensured)) return ensured;

  const db = createAdminClient();
  const [entriesRes, projectsRes, cadence] = await Promise.all([
    db
      .from("time_entries")
      .select("*")
      .eq("timesheet_id", ensured.timesheetId)
      .order("entry_date")
      .order("start_time"),
    db
      .from("projects")
      .select("*")
      .eq("org_id", profile.org_id)
      .eq("is_active", true)
      .or(`is_org_wide.eq.true,owner_id.eq.${profile.id}`)
      .order("name"),
    getOrgCadence(profile.org_id),
  ]);

  const projectMap = new Map(
    ((projectsRes.data ?? []) as Project[]).map((p) => [p.id, p]),
  );
  const entries: TimeEntryWithProject[] = ((entriesRes.data ?? []) as TimeEntry[]).map(
    (e) => ({
      ...e,
      project: e.project_id ? projectMap.get(e.project_id) ?? null : null,
    }),
  );

  return {
    ok: true,
    timesheetId: ensured.timesheetId,
    status: ensured.status,
    entries,
    projects: (projectsRes.data ?? []) as Project[],
    cadence,
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
    .select("id, start_time, end_time, is_overnight")
    .eq("employee_id", employeeId)
    .eq("entry_date", entryDate);

  for (const s of siblings ?? []) {
    if (excludeId && s.id === excludeId) continue;
    const other = toRange(
      String(s.start_time).slice(0, 5),
      String(s.end_time).slice(0, 5),
      Boolean(s.is_overnight),
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
  hours: number;
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

  return { ok: true, start, end, overnight, hours };
}

export async function upsertTimeEntry(
  payload: EntryPayload & { id?: string },
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "Your account has no organization." };

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
  const row = {
    org_id: profile.org_id,
    employee_id: profile.id,
    timesheet_id: payload.timesheetId,
    project_id: payload.projectId || null,
    entry_date: payload.entryDate,
    start_time: validated.start,
    end_time: validated.end,
    is_overnight: validated.overnight,
    total_hours: validated.hours,
    description: payload.description?.trim() || null,
    billable: payload.billable ?? true,
  };

  if (payload.id) {
    const { error } = await db
      .from("time_entries")
      .update(row)
      .eq("id", payload.id)
      .eq("employee_id", profile.id);
    if (error) return { ok: false, message: "Couldn't save entry." };
    revalidatePath("/app/timesheets");
    return { ok: true, message: "Saved.", id: payload.id };
  }

  const { data, error } = await db
    .from("time_entries")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "Couldn't create entry." };
  revalidatePath("/app/timesheets");
  return { ok: true, message: "Saved.", id: data.id };
}

export async function deleteTimeEntry(id: string): Promise<ActionResult> {
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
  revalidatePath("/app/timesheets");
  return { ok: true, message: "Deleted." };
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

  const { count } = await db
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("timesheet_id", timesheetId);
  if (!count) return { ok: false, message: "Add at least one time entry first." };

  const { error } = await db
    .from("timesheets")
    .update({ status: "submitted" })
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
    },
  });

  await notifyOrgAdmins({
    orgId: profile.org_id,
    type: "timesheet_submitted",
    title: "New timesheet submitted",
    body: `${employeeName} · ${ts.period_start} – ${ts.period_end}`,
    entity: "timesheets",
    entityId: timesheetId,
    excludeUserId: profile.id,
  });

  revalidatePath("/app/timesheets");
  revalidatePath("/app/dashboard");
  return { ok: true, message: "Timesheet submitted for approval." };
}

export async function checkTimeLogReminder(): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id || profile.role !== "employee") {
    return { ok: true, message: "" };
  }

  const cadence = await getOrgCadence(profile.org_id);
  const today = toIsoDate(new Date());
  const period = periodForDate(today, cadence);
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
    body: `You haven't logged time in the last 3 days (${period.label}).`,
    entity: "timesheets",
  });

  return { ok: true, message: "Reminder sent." };
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
    (profile.role === "admin" && ts.org_id === profile.org_id);
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
