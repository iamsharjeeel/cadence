import type { Metadata } from "next";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEventsForDateRange,
  hasSyncedCalendars,
} from "@/lib/google-calendar/sync";
import { hasGCalConnection } from "@/lib/google-calendar/connection";
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

async function loadPersonalLeave(profile: Awaited<ReturnType<typeof requireActiveProfile>>) {
  if (!profile.org_id) return null;

  const year = new Date().getFullYear();
  const calendarMonth = new Date().toISOString().slice(0, 7);
  const monthStart = `${calendarMonth}-01`;
  const monthEnd = `${calendarMonth}-${String(new Date(Number(calendarMonth.slice(0, 4)), Number(calendarMonth.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;

  const [balances, requests, leaveTypes, gcalConnected, gcalSynced] =
    await Promise.all([
      getLeaveBalancesForEmployee(profile, year),
      getLeaveRequestsForEmployee(profile),
      getOrgLeaveTypes(profile.org_id),
      hasGCalConnection(profile.id),
      hasSyncedCalendars(profile.id),
    ]);

  const showGoogleCalendar = gcalConnected && gcalSynced;
  const googleCalendarEvents =
    showGoogleCalendar
      ? await getEventsForDateRange(profile.id, monthStart, monthEnd)
      : [];

  return (
    <LeaveEmployeeView
      balances={balances}
      requests={requests}
      leaveTypes={leaveTypes}
      calendarMonth={calendarMonth}
      googleCalendarEvents={googleCalendarEvents}
      showGoogleCalendar={showGoogleCalendar}
    />
  );
}

async function loadAdminBalances(orgId: string) {
  const db = createAdminClient();
  const year = new Date().getFullYear();

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
      ? db.from("profiles").select("id, full_name, email").in("id", employeeIds)
      : Promise.resolve({ data: [] }),
    typeIds.length
      ? db.from("leave_types").select("id, name, unit").in("id", typeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map(
    (people ?? []).map((p) => [p.id, p.full_name?.trim() || p.email]),
  );
  const typeById = new Map(
    (types ?? []).map((t) => [
      t.id,
      { name: t.name, unit: t.unit === "hours" ? "hours" as const : "days" as const },
    ]),
  );

  return (balRows ?? []).map((b) => {
    const typeMeta = typeById.get(b.leave_type_id);
    return {
      id: b.id,
      employee_name: nameById.get(b.employee_id) ?? "—",
      type_name: typeMeta?.name ?? "—",
      unit: typeMeta?.unit ?? "days",
      allocated_days: Number(b.allocated_days),
      used_days: Number(b.used_days),
      pending_days: Number(b.pending_days),
      year: b.year,
    };
  });
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: { org?: string };
}) {
  const profile = await requireActiveProfile();
  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const personalLeave = await loadPersonalLeave(profile);

  if (!isManager) {
    if (!personalLeave) {
      return (
        <div>
          <PageHeader title="Leave" description="Your balances, calendar, and requests." />
          <EmptyState
            title="No organization assigned"
            description="Your profile needs an organization before you can request leave."
          />
        </div>
      );
    }

    return (
      <div>
        <PageHeader title="Leave" description="Your balances, calendar, and requests." />
        {personalLeave}
      </div>
    );
  }

  const db = createAdminClient();

  if (profile.role === "superadmin") {
    const { data: orgs } = await db
      .from("organizations")
      .select("id, name")
      .order("name");
    const orgList = orgs ?? [];
    const selectedOrgId = searchParams.org ?? orgList[0]?.id ?? "";

    if (!selectedOrgId && !personalLeave) {
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

    const pending = selectedOrgId
      ? await getPendingLeaveRequests(selectedOrgId)
      : [];
    const balances = selectedOrgId ? await loadAdminBalances(selectedOrgId) : [];

    return (
      <div>
        <PageHeader
          title="Leave"
          description={
            personalLeave
              ? "Your leave and team management."
              : "Team calendar, pending requests, and balances."
          }
        />
        {personalLeave && <div className="mb-10">{personalLeave}</div>}
        {selectedOrgId && (
          <>
            <div className="mb-6">
              <LeaveOrgSelect orgs={orgList} selectedOrgId={selectedOrgId} />
            </div>
            <LeaveAdminView pending={pending} balances={balances} />
          </>
        )}
      </div>
    );
  }

  const orgId = profile.org_id!;
  const pending = await getPendingLeaveRequests(orgId);
  const balances = await loadAdminBalances(orgId);

  return (
    <div>
      <PageHeader
        title="Leave"
        description={
          personalLeave
            ? "Your leave and team management."
            : "Team calendar, pending requests, and balances."
        }
      />
      {personalLeave && <div className="mb-10">{personalLeave}</div>}
      <LeaveAdminView pending={pending} balances={balances} />
    </div>
  );
}
