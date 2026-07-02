import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  getLeaveRequestsForWorkspace,
  getOrgLeaveTypes,
  getPendingLeaveRequests,
} from "@/lib/leave/queries";
import { getEventsForDateRange } from "@/lib/google-calendar/sync";
import { LeaveEmployeeView } from "./LeaveEmployeeView";
import { LeaveAdminView } from "./LeaveAdminView";

export const metadata: Metadata = { title: "Leave" };

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(ym: string): { start: string; end: string } {
  const [year, month] = ym.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${ym}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function resolveCalendarMonth(monthParam?: string): string {
  const current = new Date().toISOString().slice(0, 7);
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) return current;
  const [y, m] = monthParam.split("-").map(Number);
  if (m < 1 || m > 12) return current;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const profile = ctx.effectiveProfile;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const calendarMonth = resolveCalendarMonth(searchParams.month);
  const { start: monthStart, end: monthEnd } = monthBounds(calendarMonth);
  const isCurrentMonth = calendarMonth === currentMonth;
  const prevMonthHref = `/app/leave?month=${shiftMonth(calendarMonth, -1)}`;
  const nextMonthHref = `/app/leave?month=${shiftMonth(calendarMonth, 1)}`;
  const todayHref = "/app/leave";

  const inOrg = Boolean(ctx.activeOrgId);
  const isManager =
    inOrg &&
    (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin");

  const orgId = inOrg ? ctx.activeOrgId : null;
  const [requests, leaveTypes, pending, calendarEvents] = await Promise.all([
    getLeaveRequestsForWorkspace(profile.id, orgId),
    orgId ? getOrgLeaveTypes(orgId) : Promise.resolve([]),
    isManager && orgId
      ? getPendingLeaveRequests(orgId)
      : Promise.resolve([]),
    getEventsForDateRange(profile.id, monthStart, monthEnd),
  ]);

  const mode = inOrg ? "org" : "personal";

  return (
    <div>
      <PageHeader
        title="Leave"
        description={
          inOrg
            ? "Your leave calendar and team approvals."
            : "Your personal time-off calendar."
        }
      />
      <LeaveEmployeeView
        mode={mode}
        requests={requests}
        leaveTypes={leaveTypes}
        calendarMonth={calendarMonth}
        calendarEvents={calendarEvents}
        prevMonthHref={prevMonthHref}
        nextMonthHref={nextMonthHref}
        todayHref={todayHref}
        isCurrentMonth={isCurrentMonth}
      />
      {isManager ? (
        <div className="mt-10">
          <LeaveAdminView pending={pending} />
        </div>
      ) : null}
    </div>
  );
}
