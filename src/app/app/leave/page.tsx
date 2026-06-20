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

export default async function LeavePage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const profile = ctx.effectiveProfile;
  const calendarMonth = new Date().toISOString().slice(0, 7);
  const [year, month] = calendarMonth.split("-").map(Number);
  const monthStart = `${calendarMonth}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(
    new Date(year, month, 0).getDate(),
  ).padStart(2, "0")}`;
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
      />
      {isManager ? (
        <div className="mt-10">
          <LeaveAdminView pending={pending} />
        </div>
      ) : null}
    </div>
  );
}
