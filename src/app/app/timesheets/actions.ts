"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins, notifyUser } from "@/lib/notifications";
import { calculateTotal } from "@/lib/timesheets/calc";
import type { RateType } from "@/types/db";

export type ActionResult = {
  ok: boolean;
  message: string;
  calculatedTotal?: number | null;
  currency?: string | null;
};

async function totalHoursForTimesheet(db: ReturnType<typeof createAdminClient>, id: string) {
  const { data: rows } = await db
    .from("time_entries")
    .select("total_hours")
    .eq("timesheet_id", id);
  let total = (rows ?? []).reduce((sum, r) => sum + Number(r.total_hours), 0);
  if (total === 0) {
    const { data: legacyRows } = await db
      .from("timesheet_rows")
      .select("hours")
      .eq("timesheet_id", id);
    total = (legacyRows ?? []).reduce((sum, r) => sum + Number(r.hours), 0);
  }
  return total;
}

/**
 * Approves a submitted timesheet. Admin/superadmin only (scoped). Snapshots the
 * employee's CURRENT rate from the DB (never client input), computes the total
 * server-side, records approver + timestamp, queues a dormant webhook delivery,
 * and audits.
 */
export async function approveTimesheet(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireRole(["admin", "superadmin"]);
  const id = String(formData.get("id") ?? "");

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("*")
    .eq("id", id)
    .single();
  if (!ts) return { ok: false, message: "Timesheet not found." };
  if (actor.role === "admin" && ts.org_id !== actor.org_id) {
    return { ok: false, message: "That timesheet isn't in your organization." };
  }
  if (ts.status !== "submitted") {
    return { ok: false, message: "Only submitted timesheets can be approved." };
  }

  const { data: employee } = await db
    .from("profiles")
    .select("rate, rate_type, currency, full_name, email")
    .eq("id", ts.employee_id)
    .single();
  if (!employee) return { ok: false, message: "Employee profile not found." };

  const totalHours = await totalHoursForTimesheet(db, id);
  const total = calculateTotal(
    totalHours,
    employee.rate,
    employee.rate_type as RateType,
  );

  const approvedAt = new Date().toISOString();
  const { error: updErr } = await db
    .from("timesheets")
    .update({
      status: "approved",
      approved_at: approvedAt,
      approved_by: actor.id,
      rate_snapshot: employee.rate,
      rate_type_snapshot: employee.rate_type,
      currency_snapshot: employee.currency,
      calculated_total: total,
    })
    .eq("id", id);
  if (updErr) return { ok: false, message: "Couldn't approve the timesheet." };

  await db.from("webhook_deliveries").insert({
    org_id: ts.org_id,
    timesheet_id: id,
    status: "pending",
    payload: {
      event: "timesheet.approved",
      timesheet_id: id,
      employee_id: ts.employee_id,
      org_id: ts.org_id,
      period_start: ts.period_start,
      period_end: ts.period_end,
      total_hours: totalHours,
      rate_snapshot: employee.rate,
      rate_type_snapshot: employee.rate_type,
      currency_snapshot: employee.currency,
      calculated_total: total,
      approved_by: actor.id,
      approved_at: approvedAt,
    },
  });

  await writeAudit({
    actorId: actor.id,
    orgId: ts.org_id,
    action: "timesheet_approved",
    entity: "timesheets",
    payload: {
      timesheet_id: id,
      total_hours: totalHours,
      calculated_total: total,
    },
  });

  await notifyUser({
    orgId: ts.org_id,
    userId: ts.employee_id,
    type: "timesheet_approved",
    title: "Your timesheet has been approved",
    body: `${ts.period_start} – ${ts.period_end} · ${total != null ? `${employee.currency ?? "USD"} ${total.toFixed(2)}` : ""}`,
    entity: "timesheets",
    entityId: id,
  });

  revalidatePath("/app/timesheets");
  revalidatePath(`/app/timesheets/${id}`);
  revalidatePath("/app/dashboard");
  return {
    ok: true,
    message: "Timesheet approved.",
    calculatedTotal: total,
    currency: employee.currency,
  };
}

/** Bulk-approves submitted timesheets. One audit entry per timesheet. */
export async function bulkApproveTimesheets(
  ids: string[],
): Promise<ActionResult> {
  const actor = await requireRole(["admin", "superadmin"]);
  if (!ids.length) {
    return { ok: false, message: "No timesheets selected." };
  }

  const db = createAdminClient();
  let approved = 0;

  for (const id of ids) {
    const { data: ts } = await db
      .from("timesheets")
      .select("*")
      .eq("id", id)
      .single();
    if (!ts) continue;
    if (actor.role === "admin" && ts.org_id !== actor.org_id) continue;
    if (ts.status !== "submitted") continue;

    const { data: employee } = await db
      .from("profiles")
      .select("rate, rate_type, currency, full_name, email")
      .eq("id", ts.employee_id)
      .single();
    if (!employee) continue;

    const totalHours = await totalHoursForTimesheet(db, id);
    const total = calculateTotal(
      totalHours,
      employee.rate,
      employee.rate_type as RateType,
    );

    const approvedAt = new Date().toISOString();
    const { error: updErr } = await db
      .from("timesheets")
      .update({
        status: "approved",
        approved_at: approvedAt,
        approved_by: actor.id,
        rate_snapshot: employee.rate,
        rate_type_snapshot: employee.rate_type,
        currency_snapshot: employee.currency,
        calculated_total: total,
      })
      .eq("id", id);
    if (updErr) continue;

    await db.from("webhook_deliveries").insert({
      org_id: ts.org_id,
      timesheet_id: id,
      status: "pending",
      payload: {
        event: "timesheet.approved",
        timesheet_id: id,
        employee_id: ts.employee_id,
        org_id: ts.org_id,
        period_start: ts.period_start,
        period_end: ts.period_end,
        total_hours: totalHours,
        rate_snapshot: employee.rate,
        rate_type_snapshot: employee.rate_type,
        currency_snapshot: employee.currency,
        calculated_total: total,
        approved_by: actor.id,
        approved_at: approvedAt,
      },
    });

    await writeAudit({
      actorId: actor.id,
      orgId: ts.org_id,
      action: "timesheet_approved",
      entity: "timesheets",
      payload: {
        timesheet_id: id,
        total_hours: totalHours,
        calculated_total: total,
        bulk: true,
      },
    });

    await notifyUser({
      orgId: ts.org_id,
      userId: ts.employee_id,
      type: "timesheet_approved",
      title: "Your timesheet has been approved",
      body: `${ts.period_start} – ${ts.period_end}`,
      entity: "timesheets",
      entityId: id,
    });

    approved++;
  }

  revalidatePath("/app/timesheets");
  revalidatePath("/app/dashboard");

  if (approved === 0) {
    return { ok: false, message: "No timesheets could be approved." };
  }
  return {
    ok: true,
    message: `Approved ${approved} timesheet${approved === 1 ? "" : "s"}.`,
  };
}

/** Rejects a submitted timesheet with a required note. Admin/superadmin only. */
export async function rejectTimesheet(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireRole(["admin", "superadmin"]);
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, message: "A rejection note is required." };
  if (note.length > 500)
    return { ok: false, message: "Note must be 500 characters or fewer." };

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("org_id, status, employee_id, period_start, period_end")
    .eq("id", id)
    .single();
  if (!ts) return { ok: false, message: "Timesheet not found." };
  if (actor.role === "admin" && ts.org_id !== actor.org_id) {
    return { ok: false, message: "That timesheet isn't in your organization." };
  }
  if (ts.status !== "submitted") {
    return { ok: false, message: "Only submitted timesheets can be rejected." };
  }

  const { error } = await db
    .from("timesheets")
    .update({ status: "rejected", rejection_note: note })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't reject the timesheet." };

  await writeAudit({
    actorId: actor.id,
    orgId: ts.org_id,
    action: "timesheet_rejected",
    entity: "timesheets",
    payload: { timesheet_id: id, note },
  });

  await notifyUser({
    orgId: ts.org_id,
    userId: ts.employee_id,
    type: "timesheet_rejected",
    title: "Your timesheet needs changes",
    body: `${ts.period_start} – ${ts.period_end} · ${note}`,
    entity: "timesheets",
    entityId: id,
  });

  revalidatePath("/app/timesheets");
  revalidatePath(`/app/timesheets/${id}`);
  revalidatePath("/app/dashboard");
  return { ok: true, message: "Timesheet rejected." };
}
