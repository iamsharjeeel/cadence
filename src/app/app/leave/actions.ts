"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins, notifyUser } from "@/lib/notifications";
import { requireActiveProfile, requireRole } from "@/lib/auth";
import { countBusinessDays } from "@/lib/leave/days";
import {
  formatLeaveRemaining,
  type LeaveUnit,
} from "@/lib/leave/types";
import { applyDefaultBalancesForOrg } from "@/lib/leave/seed";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateDateRange,
  validateMaxLength,
  validateNonNegativeNumber,
  validateYear,
} from "@/lib/validation";

export type ActionResult = { ok: boolean; message: string };

export async function requestLeave(input: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  hoursRequested?: number;
  note?: string;
}): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: false, message: "No organization." };

  const db = createAdminClient();

  const { data: lt } = await db
    .from("leave_types")
    .select("id, category, org_id, unit")
    .eq("id", input.leaveTypeId)
    .single();
  if (!lt || lt.org_id !== profile.org_id) {
    return { ok: false, message: "Invalid leave type." };
  }

  const unit: LeaveUnit = lt.unit === "hours" ? "hours" : "days";
  let days: number;
  let start: string;
  let end: string;
  let halfDay = false;

  if (unit === "hours") {
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

  const year = new Date(start).getFullYear();

  const { data: bal } = await db
    .from("leave_balances")
    .select("*")
    .eq("employee_id", profile.id)
    .eq("leave_type_id", input.leaveTypeId)
    .eq("year", year)
    .maybeSingle();

  const remaining =
    (bal?.allocated_days ?? 0) -
    (bal?.used_days ?? 0) -
    (bal?.pending_days ?? 0);

  if (
    lt.category !== "unpaid" &&
    lt.category !== "sick" &&
    remaining < days
  ) {
    return {
      ok: false,
      message: `Insufficient balance. ${formatLeaveRemaining(remaining, unit)} remaining.`,
    };
  }

  if (bal) {
    await db
      .from("leave_balances")
      .update({ pending_days: Number(bal.pending_days) + days })
      .eq("id", bal.id);
  } else {
    await db.from("leave_balances").insert({
      org_id: profile.org_id,
      employee_id: profile.id,
      leave_type_id: input.leaveTypeId,
      year,
      allocated_days: lt.category === "unpaid" ? 365 : 0,
      used_days: 0,
      pending_days: days,
    });
  }

  const { error } = await db.from("leave_requests").insert({
    org_id: profile.org_id,
    employee_id: profile.id,
    leave_type_id: input.leaveTypeId,
    start_date: start,
    end_date: end,
    days_requested: days,
    half_day: halfDay,
    note: noteV.value || null,
    status: "pending",
  });
  if (error) return { ok: false, message: "Couldn't submit request." };

  const employeeName = profile.full_name?.trim() || profile.email;
  await notifyOrgAdmins({
    orgId: profile.org_id,
    type: "leave_requested",
    title: `Leave request from ${employeeName}`,
    body: `${start} – ${end}`,
    entity: "leave_requests",
    excludeUserId: profile.id,
  });

  await writeAudit({
    actorId: profile.id,
    orgId: profile.org_id,
    action: "leave_requested",
    entity: "leave_requests",
    payload: { leave_type_id: input.leaveTypeId, days },
  });

  revalidatePath("/app/leave");
  return { ok: true, message: "Leave request submitted." };
}

export async function cancelLeaveRequest(id: string): Promise<ActionResult> {
  const profile = await requireActiveProfile();
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

  const year = new Date(req.start_date).getFullYear();
  const { data: bal } = await db
    .from("leave_balances")
    .select("id, pending_days")
    .eq("employee_id", profile.id)
    .eq("leave_type_id", req.leave_type_id)
    .eq("year", year)
    .single();

  if (bal) {
    await db
      .from("leave_balances")
      .update({
        pending_days: Math.max(
          0,
          Number(bal.pending_days) - Number(req.days_requested),
        ),
      })
      .eq("id", bal.id);
  }

  await db
    .from("leave_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);

  await writeAudit({
    actorId: profile.id,
    orgId: req.org_id,
    action: "leave_cancelled",
    entity: "leave_requests",
    payload: { request_id: id },
  });

  revalidatePath("/app/leave");
  return { ok: true, message: "Request cancelled." };
}

export async function approveLeaveRequest(id: string): Promise<ActionResult> {
  const actor = await requireRole(["admin", "superadmin"]);
  const db = createAdminClient();

  const { data: req } = await db
    .from("leave_requests")
    .select("org_id, employee_id, start_date, end_date")
    .eq("id", id)
    .single();
  if (!req) return { ok: false, message: "Request not found." };
  if (actor.role === "admin" && req.org_id !== actor.org_id) {
    return { ok: false, message: "Forbidden." };
  }

  // TRACK C DORMANT NOTE: approve_leave_request / reject_leave_request still
  // authorize the reviewer via the vestigial auth_role()/profiles.org_id. This
  // is harmless today (org leave is not wired — leave is personal-only, with no
  // approval), but when org-scoped leave lands these RPCs MUST be reworked to
  // authorize via auth_workspace_role() against the active workspace's
  // membership (like every other tenant policy in C2).
  const { error } = await db.rpc("approve_leave_request", {
    p_request_id: id,
    p_reviewer_id: actor.id,
  });
  if (error) return { ok: false, message: "Couldn't approve request." };

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
  return { ok: true, message: "Leave approved." };
}

export async function rejectLeaveRequest(
  id: string,
  note: string,
): Promise<ActionResult> {
  const actor = await requireRole(["admin", "superadmin"]);
  if (!note.trim()) return { ok: false, message: "Rejection note required." };

  const db = createAdminClient();
  const { data: req } = await db
    .from("leave_requests")
    .select("org_id, employee_id, start_date, end_date")
    .eq("id", id)
    .single();
  if (!req) return { ok: false, message: "Request not found." };
  if (actor.role === "admin" && req.org_id !== actor.org_id) {
    return { ok: false, message: "Forbidden." };
  }

  const { error } = await db.rpc("reject_leave_request", {
    p_request_id: id,
    p_reviewer_id: actor.id,
    p_note: note.trim(),
  });
  if (error) return { ok: false, message: "Couldn't reject request." };

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

export async function applyDefaultBalances(
  orgId: string,
  year: number,
): Promise<ActionResult> {
  const actor = await requireRole(["admin", "superadmin"]);
  if (actor.role === "admin" && actor.org_id !== orgId) {
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
  const actor = await requireRole(["admin", "superadmin"]);
  const db = createAdminClient();

  const { data: bal } = await db
    .from("leave_balances")
    .select("org_id")
    .eq("id", id)
    .single();
  if (!bal) return { ok: false, message: "Balance not found." };
  if (actor.role === "admin" && bal.org_id !== actor.org_id) {
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
