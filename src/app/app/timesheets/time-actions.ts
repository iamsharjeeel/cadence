"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import {
  addDays,
  mondayOfWeek,
  toIsoDate,
  weekPeriodFromMonday,
} from "@/lib/time/periods";
import {
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
  getTimeTrackingDataForProfile,
  linkOrphanEntriesToTimesheet,
} from "@/lib/time/get-time-tracking-data";
import type { TimeEntry, TimeEntryWithProject } from "@/types/time-tracking";
import { computeTimesheetLifecycle } from "@/lib/timesheets/lifecycle";

export type ActionResult = { ok: boolean; message: string; id?: string };

export type SaveEntryResult = ActionResult & { weekStats?: WeekStats };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_STATUSES: TimesheetStatus[] = ["draft", "submitted", "rejected"];

function editableStatus(
  status: TimesheetStatus,
  periodEnd: string,
  submittedAt?: string | null,
): boolean {
  if (status === "rejected") return true;
  const lifecycle = computeTimesheetLifecycle({
    status,
    periodEnd,
    submittedAt,
  });
  return lifecycle.canEditEntries;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

async function resolveApproverIds(orgId: string): Promise<string[]> {
  const db = createAdminClient();
  const { data: settings } = await db
    .from("org_settings")
    .select("approver_scope")
    .eq("org_id", orgId)
    .maybeSingle();
  const scope = settings?.approver_scope ?? "owner_only";
  const roles: ("owner" | "admin")[] =
    scope === "owner_only" ? ["owner"] : ["owner", "admin"];
  const { data } = await db
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .in("role", roles);
  return unique((data ?? []).map((row) => row.user_id));
}

async function notifyTimesheetApprovers(params: {
  orgId: string;
  excludeUserId?: string;
  title: string;
  body: string;
  entityId: string;
  type: "timesheet_submitted";
}) {
  const db = createAdminClient();
  const approverIds = await resolveApproverIds(params.orgId);
  for (const approverId of approverIds) {
    if (approverId === params.excludeUserId) continue;
    await db.from("notifications").insert({
      org_id: params.orgId,
      user_id: approverId,
      type: params.type,
      title: params.title,
      body: params.body,
      entity: "timesheets",
      entity_id: params.entityId,
    });
  }
}

type ChronologyValidation =
  | { ok: true; entryCount: number }
  | { ok: false; message: string };

async function validatePeriodChronology(
  timesheetId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ChronologyValidation> {
  const db = createAdminClient();
  const { data: entries } = await db
    .from("time_entries")
    .select("entry_date, start_time, end_time, entry_mode, decimal_hours")
    .eq("timesheet_id", timesheetId)
    .order("entry_date")
    .order("start_time");

  const rows = entries ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      message: "Add at least one entry before submitting this timesheet.",
    };
  }

  const byDay = new Map<string, { start: string; end: string }[]>();
  for (const row of rows) {
    if (row.entry_date < periodStart || row.entry_date > periodEnd) {
      return { ok: false, message: "Entries must stay inside the selected period." };
    }
    if (row.entry_mode === "decimal_hours") continue;
    const start = String(row.start_time).slice(0, 5);
    const end = String(row.end_time).slice(0, 5);
    const ranges = byDay.get(row.entry_date) ?? [];
    ranges.push({ start, end });
    byDay.set(row.entry_date, ranges);
  }

  for (const [day, ranges] of byDay.entries()) {
    for (let i = 0; i < ranges.length; i++) {
      const current = toRange(
        ranges[i]!.start,
        ranges[i]!.end,
        isOvernightShift(ranges[i]!.start, ranges[i]!.end),
      );
      if (!current) return { ok: false, message: `Invalid time range on ${day}.` };
      for (let j = i + 1; j < ranges.length; j++) {
        const other = toRange(
          ranges[j]!.start,
          ranges[j]!.end,
          isOvernightShift(ranges[j]!.start, ranges[j]!.end),
        );
        if (other && rangesOverlap(current, other)) {
          return { ok: false, message: `Overlapping entries on ${day}.` };
        }
      }
    }
  }

  return { ok: true, entryCount: rows.length };
}

/** Fetch-or-create the single active timesheet for the anchor date. */
export async function ensureTimesheetForWeek(
  anchorDate: string,
  personalLengthDays?: number,
): Promise<{ ok: true; timesheetId: string; status: TimesheetStatus } | ActionResult> {
  const profile = await requireActiveProfile();
  const hadTimesheet = await createAdminClient()
    .from("timesheets")
    .select("id")
    .eq("employee_id", profile.id)
    .lte("period_start", anchorDate)
    .gte("period_end", anchorDate)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();

  const result = await getTimeTrackingDataForProfile(profile, anchorDate, {
    personalLengthDays,
  });
  if (result.ok && !hadTimesheet.data) {
    revalidatePath("/app/timesheets");
    revalidatePath("/app/timesheets/log");
  }
  if (!result.ok) return result;
  return { ok: true, timesheetId: result.timesheetId, status: result.status };
}

export async function getTimeTrackingData(
  anchorDate: string,
  personalLengthDays?: number,
) {
  const profile = await requireActiveProfile();
  return getTimeTrackingDataForProfile(profile, anchorDate, {
    personalLengthDays,
  });
}

async function assertEditableTimesheet(timesheetId: string, employeeId: string) {
  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, status, employee_id, org_id, period_end, submitted_at, updated_at")
    .eq("id", timesheetId)
    .single();
  if (!ts) return { ok: false as const, message: "Timesheet not found." };
  if (ts.employee_id !== employeeId) {
    return { ok: false as const, message: "Not authorized." };
  }
  const submittedAt = ts.submitted_at ?? ts.updated_at;
  if (!editableStatus(ts.status as TimesheetStatus, ts.period_end, submittedAt)) {
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
  if (ts.status !== "draft") {
    return { ok: false, message: "Only draft timesheets can be submitted." };
  }

  const lifecycle = computeTimesheetLifecycle({
    status: ts.status as TimesheetStatus,
    periodEnd: ts.period_end,
    submittedAt: ts.submitted_at ?? ts.updated_at,
    editRequestStatus:
      (ts.edit_request_status as "pending" | "approved" | "rejected" | null) ??
      null,
  });
  if (!lifecycle.canSubmit) {
    return {
      ok: false,
      message: "Submission opens automatically 3 days before period end.",
    };
  }

  await linkOrphanEntriesToTimesheet(
    timesheetId,
    profile.id,
    ts.org_id,
    ts.period_start,
    ts.period_end,
  );

  const chronology = await validatePeriodChronology(
    timesheetId,
    ts.period_start,
    ts.period_end,
  );
  if (!chronology.ok) {
    return { ok: false, message: chronology.message };
  }

  const stats = await computeWeekStats(timesheetId);
  const hasOvertime = stats.totalHours > 40;
  const otHours = overtimeHours(stats.totalHours);
  const submittedAt = new Date().toISOString();

  const { error } = await db
    .from("timesheets")
    .update({
      status: "submitted",
      submitted_at: submittedAt,
      has_overtime: hasOvertime,
      overtime_hours: hasOvertime ? otHours : 0,
      edit_request_status: null,
      edit_request_note: null,
      edit_requested_at: null,
      edit_requested_by: null,
      edit_request_reviewed_at: null,
      edit_request_reviewed_by: null,
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
      entry_count: chronology.entryCount,
      total_hours: stats.totalHours,
      has_overtime: hasOvertime,
      overtime_hours: otHours,
    },
  });

  if (ts.org_id) {
    await notifyTimesheetApprovers({
      orgId: ts.org_id,
      type: "timesheet_submitted",
      title: "New timesheet submitted",
      body: `${employeeName} · ${ts.period_start} – ${ts.period_end}${hasOvertime ? ` · Overtime +${otHours}h` : ""}`,
      entityId: timesheetId,
      excludeUserId: profile.id,
    });
  }

  if (ts.org_id) {
    void dispatchWebhookEvent(ts.org_id, {
      type: "timesheet.submitted",
      data: {
        timesheet_id: timesheetId,
        employee_id: profile.id,
        org_id: ts.org_id,
        period_start: ts.period_start,
        period_end: ts.period_end,
        entry_count: chronology.entryCount,
        total_hours: stats.totalHours,
        has_overtime: hasOvertime,
        overtime_hours: otHours,
      },
    });
  }

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  revalidatePath("/app/dashboard");
  return { ok: true, message: "Timesheet submitted." };
}

export async function requestTimesheetEdit(
  timesheetId: string,
  note: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const reason = note.trim();
  if (!reason) return { ok: false, message: "Please add a reason for the edit request." };
  if (reason.length > 500) {
    return { ok: false, message: "Reason must be 500 characters or fewer." };
  }

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select(
      "id, org_id, employee_id, status, period_end, submitted_at, updated_at, edit_request_status, resubmit_count",
    )
    .eq("id", timesheetId)
    .single();

  if (!ts || ts.employee_id !== profile.id) {
    return { ok: false, message: "Timesheet not found." };
  }

  const lifecycle = computeTimesheetLifecycle({
    status: ts.status as TimesheetStatus,
    periodEnd: ts.period_end,
    submittedAt: ts.submitted_at ?? ts.updated_at,
    editRequestStatus:
      (ts.edit_request_status as "pending" | "approved" | "rejected" | null) ??
      null,
  });
  if (!lifecycle.canRequestEdit) {
    return { ok: false, message: "This timesheet is not in a request-edit state." };
  }

  const nowIso = new Date().toISOString();

  if (!ts.org_id) {
    const { error } = await db
      .from("timesheets")
      .update({
        status: "draft",
        submitted_at: null,
        resubmit_count: (ts.resubmit_count ?? 0) + 1,
        edit_request_status: "approved",
        edit_request_note: reason,
        edit_requested_at: nowIso,
        edit_requested_by: profile.id,
        edit_request_reviewed_at: nowIso,
        edit_request_reviewed_by: profile.id,
      })
      .eq("id", timesheetId);
    if (error) return { ok: false, message: "Couldn't unlock timesheet for editing." };

    await writeAudit({
      actorId: profile.id,
      orgId: null,
      action: "timesheet_edit_request_auto_approved",
      entity: "timesheets",
      payload: {
        timesheet_id: timesheetId,
        note: reason,
      },
    });

    revalidatePath("/app/timesheets");
    revalidatePath("/app/timesheets/log");
    revalidatePath(`/app/timesheets/${timesheetId}`);
    return { ok: true, message: "Edit access granted. You can update this timesheet now." };
  }

  const { error } = await db
    .from("timesheets")
    .update({
      edit_request_status: "pending",
      edit_request_note: reason,
      edit_requested_at: nowIso,
      edit_requested_by: profile.id,
      edit_request_reviewed_at: null,
      edit_request_reviewed_by: null,
    })
    .eq("id", timesheetId);
  if (error) return { ok: false, message: "Couldn't submit edit request." };

  const approverIds = await resolveApproverIds(ts.org_id);
  const employeeName = profile.full_name?.trim() || profile.email;
  for (const approverId of approverIds) {
    if (approverId === profile.id) continue;
    await db.from("notifications").insert({
      org_id: ts.org_id,
      user_id: approverId,
      type: "timesheet_edit_requested",
      title: "Timesheet edit requested",
      body: `${employeeName}: ${reason}`,
      entity: "timesheets",
      entity_id: timesheetId,
    });
  }

  await writeAudit({
    actorId: profile.id,
    orgId: ts.org_id,
    action: "timesheet_edit_requested",
    entity: "timesheets",
    payload: {
      timesheet_id: timesheetId,
      note: reason,
    },
  });

  revalidatePath("/app/timesheets");
  revalidatePath(`/app/timesheets/${timesheetId}`);
  return { ok: true, message: "Edit request sent to approvers." };
}

export async function reviewTimesheetEditRequest(input: {
  timesheetId: string;
  decision: "approve" | "reject";
  note?: string;
}): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, org_id, employee_id, edit_request_status, resubmit_count")
    .eq("id", input.timesheetId)
    .single();

  if (!ts) return { ok: false, message: "Timesheet not found." };
  if (!ts.org_id) return { ok: false, message: "No approver flow for personal timesheets." };

  const approverIds = await resolveApproverIds(ts.org_id);
  if (!approverIds.includes(profile.id) && profile.role !== "superadmin") {
    return { ok: false, message: "Not authorized to review this request." };
  }
  if (ts.edit_request_status !== "pending") {
    return { ok: false, message: "No pending edit request to review." };
  }

  const nowIso = new Date().toISOString();
  if (input.decision === "approve") {
    const { error } = await db
      .from("timesheets")
      .update({
        status: "draft",
        submitted_at: null,
        resubmit_count: (ts.resubmit_count ?? 0) + 1,
        edit_request_status: "approved",
        edit_request_reviewed_at: nowIso,
        edit_request_reviewed_by: profile.id,
      })
      .eq("id", input.timesheetId);
    if (error) return { ok: false, message: "Couldn't approve edit request." };
  } else {
    const { error } = await db
      .from("timesheets")
      .update({
        edit_request_status: "rejected",
        edit_request_reviewed_at: nowIso,
        edit_request_reviewed_by: profile.id,
      })
      .eq("id", input.timesheetId);
    if (error) return { ok: false, message: "Couldn't reject edit request." };
  }

  await writeAudit({
    actorId: profile.id,
    orgId: ts.org_id,
    action:
      input.decision === "approve"
        ? "timesheet_edit_request_approved"
        : "timesheet_edit_request_rejected",
    entity: "timesheets",
    payload: {
      timesheet_id: input.timesheetId,
      note: input.note?.trim() || null,
    },
  });

  await db.from("notifications").insert({
    org_id: ts.org_id,
    user_id: ts.employee_id,
    type:
      input.decision === "approve"
        ? "timesheet_edit_request_approved"
        : "timesheet_edit_request_rejected",
    title:
      input.decision === "approve"
        ? "Edit request approved"
        : "Edit request rejected",
    body:
      input.note?.trim() ||
      (input.decision === "approve"
        ? "You can edit and re-submit this timesheet now."
        : "An approver rejected your request."),
    entity: "timesheets",
    entity_id: input.timesheetId,
  });

  revalidatePath("/app/timesheets");
  revalidatePath(`/app/timesheets/${input.timesheetId}`);
  revalidatePath("/app/timesheets/log");
  return {
    ok: true,
    message:
      input.decision === "approve"
        ? "Edit request approved."
        : "Edit request rejected.",
  };
}

export async function copyTimeEntryToDays(input: {
  sourceEntryId: string;
  targetDates: string[];
}): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const targetDates = unique(input.targetDates.map((d) => d.trim())).filter((d) =>
    ISO_DATE.test(d),
  );
  if (targetDates.length === 0) {
    return { ok: false, message: "Select at least one target day." };
  }

  const db = createAdminClient();
  const { data: source } = await db
    .from("time_entries")
    .select(
      "id, org_id, employee_id, timesheet_id, project_id, asana_project_id, entry_mode, decimal_hours, start_time, end_time, description, billable",
    )
    .eq("id", input.sourceEntryId)
    .single();
  if (!source || source.employee_id !== profile.id || !source.timesheet_id) {
    return { ok: false, message: "Source entry not found." };
  }

  const { data: ts } = await db
    .from("timesheets")
    .select("id, employee_id, status, period_start, period_end, submitted_at, updated_at")
    .eq("id", source.timesheet_id)
    .single();
  if (!ts || ts.employee_id !== profile.id) {
    return { ok: false, message: "Timesheet not found." };
  }

  if (
    !editableStatus(
      ts.status as TimesheetStatus,
      ts.period_end,
      ts.submitted_at ?? ts.updated_at,
    )
  ) {
    return { ok: false, message: "This timesheet is locked." };
  }

  const overnight = isOvernightShift(
    String(source.start_time).slice(0, 5),
    String(source.end_time).slice(0, 5),
  );
  let created = 0;
  for (const targetDate of targetDates) {
    if (targetDate < ts.period_start || targetDate > ts.period_end) continue;

    if (source.entry_mode !== "decimal_hours") {
      const overlap = await checkOverlap(
        profile.id,
        targetDate,
        String(source.start_time).slice(0, 5),
        String(source.end_time).slice(0, 5),
        overnight,
      );
      if (overlap) continue;
    }

    const { error } = await db.from("time_entries").insert({
      org_id: source.org_id as string,
      employee_id: source.employee_id,
      timesheet_id: source.timesheet_id,
      project_id: source.project_id,
      asana_project_id: source.asana_project_id,
      entry_date: targetDate,
      entry_mode: source.entry_mode,
      decimal_hours: source.decimal_hours,
      start_time: source.start_time,
      end_time: source.end_time,
      description: source.description,
      billable: source.billable,
    });
    if (!error) created++;
  }

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  return {
    ok: created > 0,
    message:
      created > 0
        ? `Copied entry to ${created} day${created === 1 ? "" : "s"}.`
        : "No entries were copied (overlap or invalid targets).",
  };
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
