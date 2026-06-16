"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins, notifyUser } from "@/lib/notifications";
import { requireActiveProfile } from "@/lib/auth";
import { countBusinessDays } from "@/lib/leave/days";
import { applyDefaultBalancesForOrg } from "@/lib/leave/seed";
import { pushLeaveToGoogleCalendar, removeLeaveFromGoogleCalendar } from "@/lib/google-calendar/push-leave";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  validateDateRange,
  validateMaxLength,
  validateNonNegativeNumber,
  validateYear,
} from "@/lib/validation";
import type { LeaveUnit } from "@/lib/leave/types";

export type ActionResult = { ok: boolean; message: string };

async function requireOrgWorkspace() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  if (!ctx.activeOrgId) {
    return { ok: false as const, message: "Switch to an organization workspace." };
  }
  return { ok: true as const, ctx, orgId: ctx.activeOrgId };
}

async function requireOrgManager() {
  const gate = await requireOrgWorkspace();
  if (!gate.ok) return gate;
  const { ctx, orgId } = gate;
  if (ctx.workspaceRole !== "owner" && ctx.workspaceRole !== "admin") {
    return { ok: false as const, message: "Forbidden." };
  }
  return { ok: true as const, ctx, orgId, profile: ctx.effectiveProfile };
}

function gcalWarningSuffix(
  push: Awaited<ReturnType<typeof pushLeaveToGoogleCalendar>>,
): string {
  if (push.pushed || push.reason === "not_connected") return "";
  return " (Google Calendar sync failed — your leave was still saved.)";
}

/** Personal workspace — mark days off immediately (no approval). */
export async function markPersonalLeave(input: {
  startDate: string;
  endDate: string;
  halfDay: boolean;
  note?: string;
}): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  if (ctx.activeOrgId && !ctx.isSuperadmin) {
    return { ok: false, message: "Switch to Personal to mark time off." };
  }

  const profile = ctx.effectiveProfile;
  const dates = validateDateRange(input.startDate, input.endDate);
  if (!dates.ok) return { ok: false, message: dates.error };

  const days = countBusinessDays(
    dates.value.start,
    dates.value.end,
    input.halfDay,
  );
  if (days <= 0) {
    return { ok: false, message: "Select valid weekdays for time off." };
  }

  const noteV = input.note
    ? validateMaxLength(input.note, 500, "Note")
    : { ok: true as const, value: "" };
  if (!noteV.ok) return { ok: false, message: noteV.error };

  const db = createAdminClient();
  const requestId = crypto.randomUUID();
  const { error } = await db.from("leave_requests").insert({
    id: requestId,
    org_id: null,
    employee_id: profile.id,
    leave_type_id: null,
    start_date: dates.value.start,
    end_date: dates.value.end,
    days_requested: days,
    half_day: input.halfDay,
    note: noteV.value || null,
    status: "approved",
    reviewed_at: new Date().toISOString(),
    reviewed_by: profile.id,
  });
  if (error) {
    console.error("[leave] personal mark failed:", error.message);
    return { ok: false, message: "Couldn't save time off." };
  }

  const push = await pushLeaveToGoogleCalendar({
    userId: profile.id,
    startDate: dates.value.start,
    endDate: dates.value.end,
    note: noteV.value || null,
  });

  if (push.pushed) {
    await db
      .from("leave_requests")
      .update({ google_event_id: push.eventId })
      .eq("id", requestId);
  }

  revalidatePath("/app/leave");
  return {
    ok: true,
    message: `Time off marked.${gcalWarningSuffix(push)}`,
  };
}

/** Org workspace — request leave (optional category, no balance gate). */
export async function requestLeave(input: {
  leaveTypeId?: string | null;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  hoursRequested?: number;
  note?: string;
}): Promise<ActionResult> {
  const gate = await requireOrgWorkspace();
  if (!gate.ok) return gate;

  const { ctx, orgId } = gate;
  const profile = ctx.effectiveProfile;
  const db = createAdminClient();

  let unit: LeaveUnit = "days";
  let days: number;
  let start: string;
  let end: string;
  let halfDay = false;
  let leaveTypeId: string | null = input.leaveTypeId?.trim() || null;

  if (leaveTypeId) {
    const { data: lt } = await db
      .from("leave_types")
      .select("id, org_id, unit")
      .eq("id", leaveTypeId)
      .single();
    if (!lt || lt.org_id !== orgId) {
      return { ok: false, message: "Invalid leave category." };
    }
    unit = lt.unit === "hours" ? "hours" : "days";
  }

  if (unit === "hours") {
    if (!leaveTypeId) {
      return { ok: false, message: "Select a category for hourly leave." };
    }
    if (!input.startDate) {
      return { ok: false, message: "Select a date for leave." };
    }
    const hoursV = validateNonNegativeNumber(
      input.hoursRequested ?? 0,
      "Hours requested",
    );
    if (!hoursV.ok) return { ok: false, message: hoursV.error };
    if (hoursV.value <= 0) {
      return { ok: false, message: "Enter hours requested." };
    }
    days = hoursV.value;
    start = input.startDate;
    end = input.startDate;
  } else {
    const dates = validateDateRange(input.startDate, input.endDate);
    if (!dates.ok) return { ok: false, message: dates.error };

    days = countBusinessDays(
      dates.value.start,
      dates.value.end,
      input.halfDay,
    );
    if (days <= 0) {
      return { ok: false, message: "Select valid weekdays for leave." };
    }
    start = dates.value.start;
    end = dates.value.end;
    halfDay = input.halfDay;
  }

  const noteV = input.note
    ? validateMaxLength(input.note, 500, "Note")
    : { ok: true as const, value: "" };
  if (!noteV.ok) return { ok: false, message: noteV.error };

  const { error } = await db.from("leave_requests").insert({
    org_id: orgId,
    employee_id: profile.id,
    leave_type_id: leaveTypeId,
    start_date: start,
    end_date: end,
    days_requested: days,
    half_day: halfDay,
    note: noteV.value || null,
    status: "pending",
  });
  if (error) {
    console.error("[leave] request failed:", error.message);
    return { ok: false, message: "Couldn't submit request." };
  }

  const employeeName = profile.full_name?.trim() || profile.email;
  await notifyOrgAdmins({
    orgId,
    type: "leave_requested",
    title: `Leave request from ${employeeName}`,
    body: `${start} – ${end}`,
    entity: "leave_requests",
    excludeUserId: profile.id,
  });

  await writeAudit({
    actorId: profile.id,
    orgId,
    action: "leave_requested",
    entity: "leave_requests",
    payload: { leave_type_id: leaveTypeId, days },
  });

  revalidatePath("/app/leave");
  return { ok: true, message: "Leave request submitted." };
}

export async function cancelLeaveRequest(id: string): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const ctx = await getWorkspaceContext();
  const db = createAdminClient();

  const { data: req } = await db
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (!req || req.employee_id !== profile.id) {
    return { ok: false, message: "Request not found." };
  }
  if (req.status !== "pending") {
    return { ok: false, message: "Only pending requests can be cancelled." };
  }

  const activeOrgId = ctx?.activeOrgId ?? null;
  if (req.org_id !== activeOrgId) {
    return { ok: false, message: "Request not in this workspace." };
  }

  if (req.google_event_id) {
    await removeLeaveFromGoogleCalendar({
      userId: req.employee_id,
      eventId: req.google_event_id,
    });
  }

  await db
    .from("leave_requests")
    .update({
      status: "cancelled",
      google_event_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (req.org_id) {
    await writeAudit({
      actorId: profile.id,
      orgId: req.org_id,
      action: "leave_cancelled",
      entity: "leave_requests",
      payload: { request_id: id },
    });
  }

  revalidatePath("/app/leave");
  return { ok: true, message: "Request cancelled." };
}

export async function deletePersonalLeave(id: string): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const ctx = await getWorkspaceContext();
  if (ctx?.activeOrgId && !ctx.isSuperadmin) {
    return { ok: false, message: "Switch to Personal to remove time off." };
  }

  const db = createAdminClient();
  const { data: req } = await db
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (!req || req.employee_id !== profile.id || req.org_id !== null) {
    return { ok: false, message: "Entry not found." };
  }

  if (req.google_event_id) {
    await removeLeaveFromGoogleCalendar({
      userId: profile.id,
      eventId: req.google_event_id,
    });
  }

  await db.from("leave_requests").delete().eq("id", id);

  revalidatePath("/app/leave");
  return { ok: true, message: "Time off removed." };
}

export async function approveLeaveRequest(id: string): Promise<ActionResult> {
  const gate = await requireOrgManager();
  if (!gate.ok) return gate;

  const { ctx, orgId, profile: actor } = gate;
  const db = createAdminClient();

  const { data: req } = await db
    .from("leave_requests")
    .select(
      "id, org_id, employee_id, start_date, end_date, status, leave_type_id, note",
    )
    .eq("id", id)
    .single();
  if (!req || req.org_id !== orgId) {
    return { ok: false, message: "Request not found." };
  }
  if (req.status !== "pending") {
    return { ok: false, message: "Request is not pending." };
  }

  const { error } = await db
    .from("leave_requests")
    .update({
      status: "approved",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[leave] approve failed:", error.message);
    return { ok: false, message: "Couldn't approve request." };
  }

  let categoryName: string | null = null;
  if (req.leave_type_id) {
    const { data: lt } = await db
      .from("leave_types")
      .select("name")
      .eq("id", req.leave_type_id)
      .maybeSingle();
    categoryName = lt?.name ?? null;
  }

  const push = await pushLeaveToGoogleCalendar({
    userId: req.employee_id,
    startDate: req.start_date,
    endDate: req.end_date,
    categoryName,
    note: req.note,
  });

  if (push.pushed) {
    await db
      .from("leave_requests")
      .update({ google_event_id: push.eventId })
      .eq("id", id);
  }

  await notifyUser({
    orgId: req.org_id,
    userId: req.employee_id,
    type: "leave_approved",
    title: "Your leave has been approved",
    body: `${req.start_date} – ${req.end_date}`,
    entity: "leave_requests",
    entityId: id,
  });

  await writeAudit({
    actorId: actor.id,
    orgId: req.org_id,
    action: "leave_approved",
    entity: "leave_requests",
    payload: { request_id: id },
  });

  revalidatePath("/app/leave");
  return {
    ok: true,
    message: `Leave approved.${gcalWarningSuffix(push)}`,
  };
}

export async function rejectLeaveRequest(
  id: string,
  note: string,
): Promise<ActionResult> {
  const gate = await requireOrgManager();
  if (!gate.ok) return gate;

  if (!note.trim()) return { ok: false, message: "Rejection note required." };

  const { orgId, profile: actor } = gate;
  const db = createAdminClient();

  const { data: req } = await db
    .from("leave_requests")
    .select("org_id, employee_id, start_date, end_date, status, google_event_id")
    .eq("id", id)
    .single();
  if (!req || req.org_id !== orgId) {
    return { ok: false, message: "Request not found." };
  }
  if (req.status !== "pending") {
    return { ok: false, message: "Request is not pending." };
  }

  if (req.google_event_id) {
    await removeLeaveFromGoogleCalendar({
      userId: req.employee_id,
      eventId: req.google_event_id,
    });
  }

  const { error } = await db
    .from("leave_requests")
    .update({
      status: "rejected",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      rejection_note: note.trim(),
      google_event_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[leave] reject failed:", error.message);
    return { ok: false, message: "Couldn't reject request." };
  }

  await notifyUser({
    orgId: req.org_id,
    userId: req.employee_id,
    type: "leave_rejected",
    title: "Your leave request was declined",
    body: `${req.start_date} – ${req.end_date} · ${note.trim()}`,
    entity: "leave_requests",
    entityId: id,
  });

  await writeAudit({
    actorId: actor.id,
    orgId: req.org_id,
    action: "leave_rejected",
    entity: "leave_requests",
    payload: { request_id: id, note: note.trim() },
  });

  revalidatePath("/app/leave");
  return { ok: true, message: "Leave rejected." };
}

/** Legacy settings helper — unchanged. */
export async function applyDefaultBalances(
  orgId: string,
  year: number,
): Promise<ActionResult> {
  const gate = await requireOrgManager();
  if (!gate.ok) return gate;
  if (gate.orgId !== orgId) {
    return { ok: false, message: "Forbidden." };
  }
  const yearV = validateYear(year);
  if (!yearV.ok) return { ok: false, message: yearV.error };
  const count = await applyDefaultBalancesForOrg(orgId, yearV.value);
  revalidatePath("/app/settings");
  revalidatePath("/app/leave");
  return {
    ok: true,
    message: `Balances updated for ${count} records.`,
  };
}

export async function updateLeaveBalance(
  id: string,
  allocatedDays: number,
): Promise<ActionResult> {
  const gate = await requireOrgManager();
  if (!gate.ok) return gate;

  const db = createAdminClient();
  const { data: bal } = await db
    .from("leave_balances")
    .select("org_id")
    .eq("id", id)
    .single();
  if (!bal) return { ok: false, message: "Balance not found." };
  if (bal.org_id !== gate.orgId) {
    return { ok: false, message: "Forbidden." };
  }

  const daysV = validateNonNegativeNumber(allocatedDays, "Allocated days");
  if (!daysV.ok) return { ok: false, message: daysV.error };

  const { error } = await db
    .from("leave_balances")
    .update({ allocated_days: daysV.value })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't update balance." };

  revalidatePath("/app/leave");
  return { ok: true, message: "Balance updated." };
}
