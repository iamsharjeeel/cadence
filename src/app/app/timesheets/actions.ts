"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { calculateTotal } from "@/lib/timesheets/calc";
import { validateMappedRow } from "@/lib/timesheets/validation";
import type { MappedRow } from "@/lib/timesheets/types";
import type { RateType } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };
export type SubmitResult = ActionResult & { id?: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Submits a timesheet. Re-validates every row server-side (never trusts the
 * client), enforces a period-overlap guard, uploads the raw file to a scoped
 * storage path, inserts the timesheet + rows, and writes an audit entry.
 */
export async function submitTimesheet(formData: FormData): Promise<SubmitResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) {
    return { ok: false, message: "Your account has no organization." };
  }

  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");
  if (!ISO_DATE.test(periodStart) || !ISO_DATE.test(periodEnd)) {
    return { ok: false, message: "Choose a valid pay period." };
  }
  if (periodStart > periodEnd) {
    return { ok: false, message: "Period start must be on or before the end." };
  }

  // Parse + server-side re-validation of every row.
  let mapped: MappedRow[];
  try {
    mapped = JSON.parse(String(formData.get("rows") ?? "[]")) as MappedRow[];
  } catch {
    return { ok: false, message: "Couldn't read the submitted rows." };
  }
  if (!Array.isArray(mapped) || mapped.length === 0) {
    return { ok: false, message: "Add at least one row before submitting." };
  }

  const validated = mapped.map((r, i) =>
    validateMappedRow(
      {
        date: String(r?.date ?? ""),
        hours: String(r?.hours ?? ""),
        project: String(r?.project ?? ""),
        description: String(r?.description ?? ""),
        billable: String(r?.billable ?? ""),
      },
      String(i),
    ),
  );
  const invalid = validated.filter((r) => !r.isValid).length;
  if (invalid > 0) {
    return {
      ok: false,
      message: `${invalid} row${invalid === 1 ? "" : "s"} failed validation.`,
    };
  }

  const db = createAdminClient();

  // Overlap guard — existing non-draft timesheets that intersect this period.
  const { data: clashes } = await db
    .from("timesheets")
    .select("id, period_start, period_end, status")
    .eq("employee_id", profile.id)
    .neq("status", "draft")
    .lte("period_start", periodEnd)
    .gte("period_end", periodStart);
  if (clashes && clashes.length > 0) {
    return {
      ok: false,
      message: "This period overlaps an existing timesheet.",
    };
  }

  const timesheetId = crypto.randomUUID();

  // 1. Upload the raw artifact to a scoped path (org/employee/timesheet).
  const file = formData.get("file");
  let rawFilePath: string | null = null;
  try {
    const base = `${profile.org_id}/${profile.id}/${timesheetId}`;
    if (file instanceof File && file.size > 0) {
      const ext = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
      rawFilePath = `${base}/raw.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await db.storage
        .from("timesheets")
        .upload(rawFilePath, buffer, {
          contentType: file.type || "text/csv",
          upsert: true,
        });
      if (upErr) rawFilePath = null;
    } else {
      // Paste / Sheets methods: synthesize a CSV snapshot as the raw artifact.
      rawFilePath = `${base}/raw.csv`;
      const csv = toCsv(validated);
      const { error: upErr } = await db.storage
        .from("timesheets")
        .upload(rawFilePath, csv, { contentType: "text/csv", upsert: true });
      if (upErr) rawFilePath = null;
    }
  } catch {
    rawFilePath = null;
  }

  // 2. Insert the timesheet (status submitted).
  const { error: tsErr } = await db.from("timesheets").insert({
    id: timesheetId,
    org_id: profile.org_id,
    employee_id: profile.id,
    period_start: periodStart,
    period_end: periodEnd,
    status: "submitted",
    raw_file_path: rawFilePath,
  });
  if (tsErr) {
    return { ok: false, message: "Couldn't create the timesheet." };
  }

  // 3. Bulk insert rows from the server-validated, normalized values.
  const rowsInsert = validated.map((r) => ({
    timesheet_id: timesheetId,
    org_id: profile.org_id!,
    row_date: r.row_date!,
    hours: r.hours!,
    project: r.project,
    description: r.description,
    billable: r.billable,
  }));
  const { error: rowsErr } = await db.from("timesheet_rows").insert(rowsInsert);
  if (rowsErr) {
    // Roll back the parent so we never leave an empty timesheet.
    await db.from("timesheets").delete().eq("id", timesheetId);
    return { ok: false, message: "Couldn't save the timesheet rows." };
  }

  // 4. Audit.
  await writeAudit({
    actorId: profile.id,
    orgId: profile.org_id,
    action: "timesheet_submitted",
    entity: "timesheets",
    payload: {
      timesheet_id: timesheetId,
      period_start: periodStart,
      period_end: periodEnd,
      row_count: rowsInsert.length,
    },
  });

  revalidatePath("/app/timesheets");
  return { ok: true, message: "Timesheet submitted.", id: timesheetId };
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

  // Rate is always pulled fresh from the DB, never the client.
  const { data: employee } = await db
    .from("profiles")
    .select("rate, rate_type, currency")
    .eq("id", ts.employee_id)
    .single();
  if (!employee) return { ok: false, message: "Employee profile not found." };

  const { data: rows } = await db
    .from("timesheet_rows")
    .select("hours")
    .eq("timesheet_id", id);
  const totalHours = (rows ?? []).reduce((sum, r) => sum + Number(r.hours), 0);
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

  // Dormant webhook seam — record the delivery, no HTTP call yet.
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

  revalidatePath("/app/timesheets");
  revalidatePath(`/app/timesheets/${id}`);
  return { ok: true, message: "Timesheet approved." };
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
    .select("org_id, status")
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

  revalidatePath("/app/timesheets");
  revalidatePath(`/app/timesheets/${id}`);
  return { ok: true, message: "Timesheet rejected." };
}

function toCsv(
  rows: ReturnType<typeof validateMappedRow>[],
): string {
  const header = ["date", "hours", "project", "description", "billable"];
  const body = rows.map((r) =>
    [
      r.row_date ?? "",
      String(r.hours ?? ""),
      r.project ?? "",
      (r.description ?? "").replace(/[\n,]/g, " "),
      String(r.billable),
    ].join(","),
  );
  return [header.join(","), ...body].join("\n");
}
