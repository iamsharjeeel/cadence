import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { LeaveUnit } from "@/lib/leave/types";
import type {
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Profile,
} from "@/types/db";

export type BalanceWithType = LeaveBalance & {
  leave_type: {
    name: string;
    category: string;
    color: string;
    unit: LeaveUnit;
  };
};

export type RequestWithMeta = LeaveRequest & {
  leave_type: {
    name: string;
    color: string;
    category: string;
    unit: LeaveUnit;
  };
  employee_name?: string;
};

function leaveTypeUnit(lt: LeaveType | undefined): LeaveUnit {
  return lt?.unit === "hours" ? "hours" : "days";
}

async function typesById(ids: string[]) {
  if (!ids.length) return new Map<string, LeaveType>();
  const db = createAdminClient();
  const { data } = await db.from("leave_types").select("*").in("id", ids);
  return new Map((data ?? []).map((t) => [t.id, t as LeaveType]));
}

export async function getLeaveBalancesForEmployee(
  profile: Profile,
  year: number,
): Promise<BalanceWithType[]> {
  if (!profile.org_id) return [];
  const db = createAdminClient();
  const { data } = await db
    .from("leave_balances")
    .select("*")
    .eq("employee_id", profile.id)
    .eq("year", year);

  const rows = (data ?? []) as LeaveBalance[];
  const typeMap = await typesById(rows.map((r) => r.leave_type_id));

  return rows.map((r) => {
    const lt = typeMap.get(r.leave_type_id);
    return {
      ...r,
      leave_type: {
        name: lt?.name ?? "—",
        category: lt?.category ?? "custom",
        color: lt?.color ?? "#B8862F",
        unit: leaveTypeUnit(lt),
      },
    };
  });
}

export async function getLeaveRequestsForEmployee(
  profile: Profile,
): Promise<RequestWithMeta[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("leave_requests")
    .select("*")
    .eq("employee_id", profile.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as LeaveRequest[];
  const typeMap = await typesById(rows.map((r) => r.leave_type_id));

  return rows.map((r) => {
    const lt = typeMap.get(r.leave_type_id);
    return {
      ...r,
      leave_type: {
        name: lt?.name ?? "—",
        color: lt?.color ?? "#B8862F",
        category: lt?.category ?? "custom",
        unit: leaveTypeUnit(lt),
      },
    };
  });
}

export async function getOrgLeaveTypes(orgId: string): Promise<LeaveType[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("leave_types")
    .select("*")
    .eq("org_id", orgId)
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
  const typeMap = await typesById(rows.map((r) => r.leave_type_id));

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

  return rows.map((r) => {
    const lt = typeMap.get(r.leave_type_id);
    return {
      ...r,
      leave_type: {
        name: lt?.name ?? "—",
        color: lt?.color ?? "#B8862F",
        category: lt?.category ?? "custom",
        unit: leaveTypeUnit(lt),
      },
      employee_name: nameById.get(r.employee_id),
    };
  });
}

export async function getApprovedLeaveInPeriod(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  const db = createAdminClient();
  const { data } = await db
    .from("leave_requests")
    .select("days_requested")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .lte("start_date", periodEnd)
    .gte("end_date", periodStart);
  return (data ?? []).reduce((s, r) => s + Number(r.days_requested), 0);
}
