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
 * Streams approved timesheets as CSV. Admin/superadmin only; re-checks role
 * server-side. Never exposes unapproved timesheets.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  if (profile.role !== "admin" && profile.role !== "superadmin") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Content-Type": "application/json" } },
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
  let query = db
    .from("timesheets")
    .select(
      "id, employee_id, period_start, period_end, calculated_total, currency_snapshot, rate_snapshot, rate_type_snapshot, approved_at, approved_by, org_id",
    )
    .eq("status", "approved")
    .gte("period_start", from)
    .lte("period_end", to)
    .order("period_start", { ascending: true });

  if (profile.role === "admin") {
    query = query.eq("org_id", profile.org_id!);
  }

  const { data: timesheets } = await query;
  if (!timesheets?.length) {
    const header =
      "employee_name,email,role,rate,rate_type,currency,period_start,period_end,total_hours,calculated_total,approved_at,approved_by\n";
    return new NextResponse(header, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cadence-export-${from}-${to}.csv"`,
      },
    });
  }

  const employeeIds = [...new Set(timesheets.map((t) => t.employee_id))];
  const approverIds = [
    ...new Set(timesheets.map((t) => t.approved_by).filter(Boolean)),
  ] as string[];

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, email, role, rate, rate_type, currency")
    .in("id", [...employeeIds, ...approverIds]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const timesheetIds = timesheets.map((t) => t.id);
  const { data: rowData } = await db
    .from("timesheet_rows")
    .select("timesheet_id, hours")
    .in("timesheet_id", timesheetIds);

  const hoursByTimesheet = new Map<string, number>();
  for (const row of rowData ?? []) {
    hoursByTimesheet.set(
      row.timesheet_id,
      (hoursByTimesheet.get(row.timesheet_id) ?? 0) + Number(row.hours),
    );
  }

  const columns = [
    "employee_name",
    "email",
    "role",
    "rate",
    "rate_type",
    "currency",
    "period_start",
    "period_end",
    "total_hours",
    "calculated_total",
    "approved_at",
    "approved_by",
  ];

  const lines = [columns.join(",")];

  for (const t of timesheets) {
    const emp = profileById.get(t.employee_id);
    const approver = t.approved_by
      ? profileById.get(t.approved_by)
      : null;
    lines.push(
      [
        csvEscape(emp?.full_name?.trim() || emp?.email),
        csvEscape(emp?.email),
        csvEscape(emp?.role),
        csvEscape(t.rate_snapshot ?? emp?.rate),
        csvEscape(t.rate_type_snapshot ?? emp?.rate_type),
        csvEscape(t.currency_snapshot ?? emp?.currency),
        csvEscape(t.period_start),
        csvEscape(t.period_end),
        csvEscape(hoursByTimesheet.get(t.id) ?? 0),
        csvEscape(t.calculated_total),
        csvEscape(t.approved_at),
        csvEscape(approver?.full_name?.trim() || approver?.email),
      ].join(","),
    );
  }

  const body = lines.join("\n") + "\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cadence-export-${from}-${to}.csv"`,
    },
  });
}
