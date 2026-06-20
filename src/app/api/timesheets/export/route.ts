import { NextRequest, NextResponse } from "next/server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Streams timesheets as CSV.
 * - Org-manager context (admin with active org): approved team export.
 * - Everyone else: personal export of the caller's own timesheets.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json(
      { error: "Valid from and to dates are required." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: "From date must be on or before to date." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = createAdminClient();
  const isOrgManagerExport = profile.role === "admin" && Boolean(profile.org_id);
  let query = db
    .from("timesheets")
    .select(
      "id, employee_id, status, period_start, period_end, calculated_total, currency_snapshot, rate_snapshot, rate_type_snapshot, submitted_at, approved_at, approved_by, org_id",
    )
    .gte("period_start", from)
    .lte("period_end", to)
    .order("period_start", { ascending: true });

  if (isOrgManagerExport) {
    query = query.eq("org_id", profile.org_id!).eq("status", "approved");
  } else {
    query = query.eq("employee_id", profile.id);
    query = profile.org_id ? query.eq("org_id", profile.org_id) : query.is("org_id", null);
  }

  const { data: timesheets } = await query;
  if (!timesheets?.length) {
    const header = isOrgManagerExport
      ? "employee_name,email,role,rate,rate_type,currency,period_start,period_end,status,total_hours,calculated_total,submitted_at,approved_at,approved_by\n"
      : "period_start,period_end,status,total_hours,calculated_total,currency,submitted_at,approved_at\n";
    return new NextResponse(header, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cadence-export-${from}-${to}.csv"`,
      },
    });
  }

  const profileById = new Map<string, any>();
  if (isOrgManagerExport) {
    const employeeIds = [...new Set(timesheets.map((t) => t.employee_id))];
    const approverIds = [
      ...new Set(timesheets.map((t) => t.approved_by).filter(Boolean)),
    ] as string[];
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, email, role, rate, rate_type, currency")
      .in("id", [...employeeIds, ...approverIds]);
    for (const person of profiles ?? []) {
      profileById.set(person.id, person);
    }
  }

  const timesheetIds = timesheets.map((t) => t.id);
  const [{ data: legacyRows }, { data: timeEntries }] = await Promise.all([
    db
      .from("timesheet_rows")
      .select("timesheet_id, hours")
      .in("timesheet_id", timesheetIds),
    db
      .from("time_entries")
      .select("timesheet_id, entry_mode, decimal_hours, start_time, end_time")
      .in("timesheet_id", timesheetIds),
  ]);

  const hoursByTimesheet = new Map<string, number>();
  for (const row of legacyRows ?? []) {
    hoursByTimesheet.set(
      row.timesheet_id,
      (hoursByTimesheet.get(row.timesheet_id) ?? 0) + Number(row.hours),
    );
  }
  for (const entry of timeEntries ?? []) {
    if (!entry.timesheet_id) continue;
    const hours =
      entry.entry_mode === "decimal_hours" && entry.decimal_hours != null
        ? Number(entry.decimal_hours)
        : (new Date(`1970-01-01T${String(entry.end_time).slice(0, 5)}:00Z`).getTime() -
            new Date(`1970-01-01T${String(entry.start_time).slice(0, 5)}:00Z`).getTime()) /
          3_600_000;
    const normalized = hours < 0 ? hours + 24 : hours;
    hoursByTimesheet.set(
      entry.timesheet_id,
      (hoursByTimesheet.get(entry.timesheet_id) ?? 0) + normalized,
    );
  }

  const columns = isOrgManagerExport
    ? [
        "employee_name",
        "email",
        "role",
        "rate",
        "rate_type",
        "currency",
        "period_start",
        "period_end",
        "status",
        "total_hours",
        "calculated_total",
        "submitted_at",
        "approved_at",
        "approved_by",
      ]
    : [
        "period_start",
        "period_end",
        "status",
        "total_hours",
        "calculated_total",
        "currency",
        "submitted_at",
        "approved_at",
      ];
  const lines = [columns.join(",")];

  for (const timesheet of timesheets) {
    const totalHours = Math.round((hoursByTimesheet.get(timesheet.id) ?? 0) * 100) / 100;
    if (isOrgManagerExport) {
      const employee = profileById.get(timesheet.employee_id);
      const approver = timesheet.approved_by
        ? profileById.get(timesheet.approved_by)
        : null;
      lines.push(
        [
          csvEscape(employee?.full_name?.trim() || employee?.email),
          csvEscape(employee?.email),
          csvEscape(employee?.role),
          csvEscape(timesheet.rate_snapshot ?? employee?.rate),
          csvEscape(timesheet.rate_type_snapshot ?? employee?.rate_type),
          csvEscape(timesheet.currency_snapshot ?? employee?.currency),
          csvEscape(timesheet.period_start),
          csvEscape(timesheet.period_end),
          csvEscape(timesheet.status),
          csvEscape(totalHours),
          csvEscape(timesheet.calculated_total),
          csvEscape(timesheet.submitted_at),
          csvEscape(timesheet.approved_at),
          csvEscape(approver?.full_name?.trim() || approver?.email),
        ].join(","),
      );
    } else {
      lines.push(
        [
          csvEscape(timesheet.period_start),
          csvEscape(timesheet.period_end),
          csvEscape(timesheet.status),
          csvEscape(totalHours),
          csvEscape(timesheet.calculated_total),
          csvEscape(timesheet.currency_snapshot ?? profile.currency),
          csvEscape(timesheet.submitted_at),
          csvEscape(timesheet.approved_at),
        ].join(","),
      );
    }
  }

  const body = lines.join("\n") + "\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cadence-export-${from}-${to}.csv"`,
    },
  });
}
