"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins, notifyUser } from "@/lib/notifications";
import { calculateTotal } from "@/lib/timesheets/calc";
import { durationHours } from "@/lib/time/validation";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
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
    .select("start_time, end_time, entry_mode, decimal_hours")
    .eq("timesheet_id", id);
  // Recompute with overnight wrapping — never sum the generated total_hours
  // column (negative for overnight). Drives calculated_total (pay) at approval.
  let total =
    Math.round(
      (rows ?? []).reduce((sum, r) => {
        const hrs =
          r.entry_mode === "decimal_hours" && r.decimal_hours != null
            ? Number(r.decimal_hours)
            : durationHours(
                String(r.start_time).slice(0, 5),
                String(r.end_time).slice(0, 5),
              ) ?? 0;
        return sum + hrs;
      }, 0) * 100,
    ) / 100;
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
  if (actor.role === "admin" && (!actor.org_id || ts.org_id !== actor.org_id)) {
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

  if (ts.org_id) {
    void dispatchWebhookEvent(ts.org_id, {
      type: "timesheet.approved",
      data: {
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
  }

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

  const uniqueIds = [...new Set(ids)];
  const { data: prefetchedTimesheets } = await db
    .from("timesheets")
    .select("*")
    .in("id", uniqueIds);
  const timesheetById = new Map(
    (prefetchedTimesheets ?? []).map((timesheet) => [timesheet.id, timesheet]),
  );
  const employeeIds = [
    ...new Set((prefetchedTimesheets ?? []).map((timesheet) => timesheet.employee_id)),
  ];
  const [{ data: prefetchedEmployees }, { data: entryRows }, { data: legacyRows }] =
    await Promise.all([
      employeeIds.length
        ? db
            .from("profiles")
            .select("id, rate, rate_type, currency, full_name, email")
            .in("id", employeeIds)
        : Promise.resolve({ data: [] }),
      db
        .from("time_entries")
        .select("timesheet_id, start_time, end_time, entry_mode, decimal_hours")
        .in("timesheet_id", uniqueIds),
      db
        .from("timesheet_rows")
        .select("timesheet_id, hours")
        .in("timesheet_id", uniqueIds),
    ]);
  const employeeById = new Map(
    (prefetchedEmployees ?? []).map((employee) => [employee.id, employee]),
  );
  const entriesByTimesheet = new Map<string, typeof entryRows>();
  for (const row of entryRows ?? []) {
    if (!row.timesheet_id) continue;
    const rows = entriesByTimesheet.get(row.timesheet_id) ?? [];
    rows.push(row);
    entriesByTimesheet.set(row.timesheet_id, rows);
  }
  const legacyHoursByTimesheet = new Map<string, number>();
  for (const row of legacyRows ?? []) {
    legacyHoursByTimesheet.set(
      row.timesheet_id,
      (legacyHoursByTimesheet.get(row.timesheet_id) ?? 0) + Number(row.hours),
    );
  }

  for (const id of ids) {
    const ts = timesheetById.get(id);
    if (!ts) continue;
    if (actor.role === "admin" && (!actor.org_id || ts.org_id !== actor.org_id)) continue;
    if (ts.status !== "submitted") continue;

    const employee = employeeById.get(ts.employee_id);
    if (!employee) continue;

    const calculatedHours = Math.round(
      (entriesByTimesheet.get(id) ?? []).reduce((sum, row) => {
        const hours =
          row.entry_mode === "decimal_hours" && row.decimal_hours != null
            ? Number(row.decimal_hours)
            : durationHours(
                String(row.start_time).slice(0, 5),
                String(row.end_time).slice(0, 5),
              ) ?? 0;
        return sum + hours;
      }, 0) * 100,
    ) / 100;
    const totalHours =
      calculatedHours === 0
        ? legacyHoursByTimesheet.get(id) ?? 0
        : calculatedHours;
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
    ts.status = "approved";

    if (ts.org_id) {
      void dispatchWebhookEvent(ts.org_id, {
        type: "timesheet.approved",
        data: {
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
    }

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
  if (actor.role === "admin" && (!actor.org_id || ts.org_id !== actor.org_id)) {
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

/** Sets a submitted timesheet back to draft (employee recall). */
export async function recallTimesheet(id: string): Promise<ActionResult> {
  const profile = await requireRole(["admin", "superadmin", "employee"]);
  if (!id) return { ok: false, message: "Timesheet not found." };

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, org_id, employee_id, status, period_start, period_end")
    .eq("id", id)
    .single();
  if (!ts) return { ok: false, message: "Timesheet not found." };
  if (ts.status !== "submitted") {
    return { ok: false, message: "Only submitted timesheets can be recalled." };
  }

  const isOwner = ts.employee_id === profile.id;
  const isOrgAdmin =
    profile.role === "admin" &&
    profile.org_id != null &&
    ts.org_id === profile.org_id;
  const isSuperadmin = profile.role === "superadmin";
  if (!isOwner && !isOrgAdmin && !isSuperadmin) {
    return { ok: false, message: "Not authorized." };
  }

  const { error } = await db
    .from("timesheets")
    .update({ status: "draft" })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't recall the timesheet." };

  await writeAudit({
    actorId: profile.id,
    orgId: ts.org_id,
    action: "timesheet_recalled",
    entity: "timesheets",
    payload: { timesheet_id: id, period_start: ts.period_start, period_end: ts.period_end },
  });

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  revalidatePath(`/app/timesheets/${id}`);
  return { ok: true, message: "Timesheet recalled. You can now edit and resubmit." };
}

/** Sets a rejected timesheet back to draft so the employee can fix and resubmit. */
export async function returnTimesheetToDraft(id: string): Promise<ActionResult> {
  const profile = await requireRole(["admin", "superadmin", "employee"]);
  if (!id) return { ok: false, message: "Timesheet not found." };

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, org_id, employee_id, status, period_start, period_end")
    .eq("id", id)
    .single();
  if (!ts) return { ok: false, message: "Timesheet not found." };
  if (ts.status !== "rejected") {
    return { ok: false, message: "Only rejected timesheets can be returned to draft." };
  }

  const isOwner = ts.employee_id === profile.id;
  const isOrgAdmin =
    profile.role === "admin" &&
    profile.org_id != null &&
    ts.org_id === profile.org_id;
  const isSuperadmin = profile.role === "superadmin";
  if (!isOwner && !isOrgAdmin && !isSuperadmin) {
    return { ok: false, message: "Not authorized." };
  }

  const { error } = await db
    .from("timesheets")
    .update({ status: "draft", rejection_note: null })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't update timesheet." };

  await writeAudit({
    actorId: profile.id,
    orgId: ts.org_id,
    action: "timesheet_returned_to_draft",
    entity: "timesheets",
    payload: { timesheet_id: id, period_start: ts.period_start, period_end: ts.period_end },
  });

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  revalidatePath(`/app/timesheets/${id}`);
  return { ok: true, message: "Timesheet is now in draft. Make your changes and resubmit." };
}

/** Deletes a timesheet (any non-approved status, plus approved with explicit confirmation). */
export async function deleteTimesheet(id: string): Promise<ActionResult> {
  const profile = await requireRole(["admin", "superadmin", "employee"]);
  if (!id) return { ok: false, message: "Timesheet not found." };

  const db = createAdminClient();
  const { data: ts } = await db
    .from("timesheets")
    .select("id, org_id, employee_id, status, period_start, period_end")
    .eq("id", id)
    .single();
  if (!ts) return { ok: false, message: "Timesheet not found." };

  const isOwner = ts.employee_id === profile.id;
  const isOrgAdmin =
    profile.role === "admin" &&
    profile.org_id != null &&
    ts.org_id === profile.org_id;
  const isSuperadmin = profile.role === "superadmin";

  if (!isOwner && !isOrgAdmin && !isSuperadmin) {
    return { ok: false, message: "Not authorized." };
  }

  // Write audit BEFORE deletion so the record exists even after rows are gone.
  await writeAudit({
    actorId: profile.id,
    orgId: ts.org_id,
    action: "timesheet_deleted",
    entity: "timesheets",
    payload: {
      timesheet_id: id,
      employee_id: ts.employee_id,
      period_start: ts.period_start,
      period_end: ts.period_end,
      status_at_delete: ts.status,
    },
  });

  // Clean up FK dependents before deleting the timesheet row.
  // Documents are orphaned (not deleted) — the warning is shown in the UI.
  await db.from("time_entries").delete().eq("timesheet_id", id);
  await db.from("timesheet_rows").delete().eq("timesheet_id", id);
  await db.from("webhook_deliveries").delete().eq("timesheet_id", id);
  // Orphan documents so they survive (preserve pay advice / invoices).
  await db
    .from("documents")
    .update({ timesheet_id: null })
    .eq("timesheet_id", id);

  const { error } = await db.from("timesheets").delete().eq("id", id);
  if (error) {
    console.error("[deleteTimesheet] FK constraint on timesheets delete", { id, error });
    return { ok: false, message: "Couldn't delete the timesheet — a related record is blocking deletion. Contact support." };
  }

  revalidatePath("/app/timesheets");
  revalidatePath("/app/timesheets/log");
  revalidatePath("/app/dashboard");
  return { ok: true, message: "Timesheet deleted." };
}
