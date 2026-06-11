import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLeaveBalancesForEmployee,
  getLeaveRequestsForEmployee,
  getOrgLeaveTypes,
  getPendingLeaveRequests,
} from "@/lib/leave/queries";
import { LeaveEmployeeView } from "./LeaveEmployeeView";
import { LeaveAdminView } from "./LeaveAdminView";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage() {
  const profile = await requireActiveProfile();
  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const year = new Date().getFullYear();
  const calendarMonth = new Date().toISOString().slice(0, 7);

  if (!isManager) {
    const [balances, requests, leaveTypes] = await Promise.all([
      getLeaveBalancesForEmployee(profile, year),
      getLeaveRequestsForEmployee(profile),
      profile.org_id ? getOrgLeaveTypes(profile.org_id) : Promise.resolve([]),
    ]);

    return (
      <div>
        <PageHeader
          title="Leave"
          description="Your balances, calendar, and requests."
        />
        <LeaveEmployeeView
          balances={balances}
          requests={requests}
          leaveTypes={leaveTypes}
          calendarMonth={calendarMonth}
        />
      </div>
    );
  }

  const orgId = profile.role === "admin" ? profile.org_id! : null;
  const db = createAdminClient();

  let orgIds: string[] = [];
  if (profile.role === "superadmin") {
    const { data: orgs } = await db.from("organizations").select("id");
    orgIds = (orgs ?? []).map((o) => o.id);
  } else if (orgId) {
    orgIds = [orgId];
  }

  const pendingLists = await Promise.all(
    orgIds.map((id) => getPendingLeaveRequests(id)),
  );
  const pending = pendingLists.flat();

  let balQuery = db
    .from("leave_balances")
    .select(
      "id, allocated_days, used_days, pending_days, year, employee_id, leave_type_id",
    )
    .eq("year", year);
  if (orgId) balQuery = balQuery.eq("org_id", orgId);
  else if (orgIds.length) balQuery = balQuery.in("org_id", orgIds);

  const { data: balRows } = await balQuery;

  const employeeIds = [...new Set((balRows ?? []).map((b) => b.employee_id))];
  const typeIds = [...new Set((balRows ?? []).map((b) => b.leave_type_id))];

  const [{ data: people }, { data: types }] = await Promise.all([
    employeeIds.length
      ? db
          .from("profiles")
          .select("id, full_name, email")
          .in("id", employeeIds)
      : Promise.resolve({ data: [] }),
    typeIds.length
      ? db.from("leave_types").select("id, name").in("id", typeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map(
    (people ?? []).map((p) => [p.id, p.full_name?.trim() || p.email]),
  );
  const typeById = new Map((types ?? []).map((t) => [t.id, t.name]));

  const balances = (balRows ?? []).map((b) => ({
    id: b.id,
    employee_name: nameById.get(b.employee_id) ?? "—",
    type_name: typeById.get(b.leave_type_id) ?? "—",
    allocated_days: Number(b.allocated_days),
    used_days: Number(b.used_days),
    pending_days: Number(b.pending_days),
    year: b.year,
  }));

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Team calendar, pending requests, and balances."
      />
      <LeaveAdminView pending={pending} balances={balances} />
    </div>
  );
}
