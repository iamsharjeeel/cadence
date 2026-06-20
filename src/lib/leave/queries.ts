import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { LeaveUnit } from "@/lib/leave/types";
import type { LeaveRequest, LeaveType } from "@/types/db";

export type GCalEventForLeave = {
  id: string;
  google_event_id: string;
  title: string | null;
  start_at: string;
  end_at: string;
};

export async function getGCalEventsForMonth(
  userId: string,
  calendarMonth: string,
): Promise<GCalEventForLeave[]> {
  const db = createAdminClient();
  const monthStart = `${calendarMonth}-01`;
  const [y, m] = calendarMonth.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, "0")}-01`;

  const { data } = await db
    .from("google_calendar_events")
    .select("id, google_event_id, title, start_at, end_at")
    .eq("user_id", userId)
    .gte("start_at", `${monthStart}T00:00:00`)
    .lt("start_at", `${nextMonth}T00:00:00`)
    .order("start_at");

  return (data ?? []) as GCalEventForLeave[];
}

export type RequestWithMeta = LeaveRequest & {
  leave_type: {
    name: string;
    color: string;
    category: string;
    unit: LeaveUnit;
  } | null;
  employee_name?: string;
};

function leaveTypeUnit(lt: LeaveType | undefined): LeaveUnit {
  return lt?.unit === "hours" ? "hours" : "days";
}

function metaForType(lt: LeaveType | undefined): RequestWithMeta["leave_type"] {
  if (!lt) return null;
  return {
    name: lt.name,
    color: lt.color ?? "#B8862F",
    category: lt.category,
    unit: leaveTypeUnit(lt),
  };
}

async function typesById(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, LeaveType>();
  const db = createAdminClient();
  const { data } = await db.from("leave_types").select("*").in("id", unique);
  return new Map((data ?? []).map((t) => [t.id, t as LeaveType]));
}

function mapRequests(
  rows: LeaveRequest[],
  typeMap: Map<string, LeaveType>,
  nameById?: Map<string, string>,
): RequestWithMeta[] {
  return rows.map((r) => ({
    ...r,
    leave_type: r.leave_type_id
      ? metaForType(typeMap.get(r.leave_type_id))
      : null,
    employee_name: nameById?.get(r.employee_id),
  }));
}

/** Leave entries for the active workspace (personal: org_id null). */
export async function getLeaveRequestsForWorkspace(
  employeeId: string,
  orgId: string | null,
): Promise<RequestWithMeta[]> {
  const db = createAdminClient();
  let query = db
    .from("leave_requests")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  query = orgId === null ? query.is("org_id", null) : query.eq("org_id", orgId);

  const { data } = await query;
  const rows = (data ?? []) as LeaveRequest[];
  const typeMap = await typesById(
    rows.map((r) => r.leave_type_id).filter((id): id is string => Boolean(id)),
  );
  return mapRequests(rows, typeMap);
}

export async function getOrgLeaveTypes(orgId: string): Promise<LeaveType[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("leave_types")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as LeaveType[];
}

export async function getPendingLeaveRequests(
  orgId: string,
): Promise<RequestWithMeta[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("leave_requests")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as LeaveRequest[];
  const typeMap = await typesById(
    rows.map((r) => r.leave_type_id).filter((id): id is string => Boolean(id)),
  );

  const employeeIds = [...new Set(rows.map((r) => r.employee_id))];
  const { data: people } = employeeIds.length
    ? await db
        .from("profiles")
        .select("id, full_name, email")
        .in("id", employeeIds)
    : { data: [] };

  const nameById = new Map(
    (people ?? []).map((p) => [p.id, p.full_name?.trim() || p.email]),
  );

  return mapRequests(rows, typeMap, nameById);
}

export async function getApprovedLeaveInPeriod(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  orgId?: string | null,
): Promise<number> {
  const db = createAdminClient();
  let query = db
    .from("leave_requests")
    .select("days_requested")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .lte("start_date", periodEnd)
    .gte("end_date", periodStart);

  if (orgId === null) {
    query = query.is("org_id", null);
  } else if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data } = await query;
  return (data ?? []).reduce((s, r) => s + Number(r.days_requested), 0);
}
