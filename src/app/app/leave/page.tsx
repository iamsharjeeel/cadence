import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { LeaveOrgSelect } from "./LeaveOrgSelect";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: { org?: string };
}) {
  const profile = await requireActiveProfile();
  const year = new Date().getFullYear();
  const calendarMonth = new Date().toISOString().slice(0, 7);
  const db = createAdminClient();

  if (profile.role === "employee") {
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

  if (profile.role === "superadmin") {
    const { data: orgs } = await db
      .from("organizations")
      .select("id, name")
      .order("name");
    const orgList = orgs ?? [];
    const selectedOrgId = searchParams.org ?? orgList[0]?.id ?? "";

    if (!selectedOrgId) {
      return (
        <div>
          <PageHeader title="Leave" description="Team leave by organization." />
          <EmptyState
            title="No organizations"
            description="Create an organization to manage leave."
          />
        </div>
      );
    }

    const pending = await getPendingLeaveRequests(selectedOrgId);
    const { data: balRows } = await db
      .from("leave_balances")
      .select(
        "id, allocated_days, used_days, pending_days, year, employee_id, leave_type_id",
      )
      .eq("org_id", selectedOrgId)
      .eq("year", year);

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
        <div className="mb-6">
          <LeaveOrgSelect orgs={orgList} selectedOrgId={selectedOrgId} />
        </div>
        <LeaveAdminView pending={pending} balances={balances} />
      </div>
    );
  }

  // Admin — own org
  const orgId = profile.org_id!;
  const pending = await getPendingLeaveRequests(orgId);

  const { data: balRows } = await db
    .from("leave_balances")
    .select(
      "id, allocated_days, used_days, pending_days, year, employee_id, leave_type_id",
    )
    .eq("org_id", orgId)
    .eq("year", year);

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
