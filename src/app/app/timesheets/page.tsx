import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { computeTimesheetLifecycle } from "@/lib/timesheets/lifecycle";
import { getWorkspaceContext } from "@/lib/workspace";
import type { Profile, Timesheet, TimesheetStatus } from "@/types/db";
import { TimesheetFilters } from "./controls";
import { TimesheetListTable, type TimesheetListRow } from "./TimesheetListTable";
import { TimesheetPageActions } from "./TimesheetPageActions";

export const metadata: Metadata = { title: "Timesheets" };

type Row = Timesheet & { rows: { count: number }[] };
type SortKey = "period" | "total" | "submitted";

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    from?: string;
    to?: string;
    sort?: string;
    dir?: string;
  };
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const profile = ctx.effectiveProfile;
  const showTeamSection =
    Boolean(ctx.activeOrgId) &&
    (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin");

  const statusFilter = (searchParams.status ?? "") as TimesheetStatus | "";
  const fromFilter = searchParams.from ?? "";
  const toFilter = searchParams.to ?? "";
  const sort = (searchParams.sort ?? "period") as SortKey;
  const dir = searchParams.dir === "asc" ? "asc" : "desc";

  const db = createClient();
  let myQuery = db
    .from("timesheets")
    .select("*, rows:timesheet_rows(count)")
    .eq("employee_id", profile.id);

  myQuery = ctx.activeOrgId ? myQuery.eq("org_id", ctx.activeOrgId) : myQuery.is("org_id", null);

  if (statusFilter) myQuery = myQuery.eq("status", statusFilter);
  if (fromFilter) myQuery = myQuery.gte("period_start", fromFilter);
  if (toFilter) myQuery = myQuery.lte("period_end", toFilter);

  if (sort === "total") {
    myQuery = myQuery.order("calculated_total", { ascending: dir === "asc", nullsFirst: false });
  } else if (sort === "submitted") {
    myQuery = myQuery.order("created_at", { ascending: dir === "asc" });
  } else {
    myQuery = myQuery.order("period_start", { ascending: dir === "asc" });
  }

  const { data: myData } = await myQuery;
  const myTimesheets = (myData ?? []) as Row[];

  let teamTimesheets: Row[] = [];
  if (showTeamSection && ctx.activeOrgId) {
    const { data: teamData } = await db
      .from("timesheets")
      .select("*, rows:timesheet_rows(count)")
      .eq("org_id", ctx.activeOrgId)
      .neq("employee_id", profile.id)
      .order("period_start", { ascending: false })
      .limit(200);
    teamTimesheets = (teamData ?? []) as Row[];
  }

  const allIds = [...myTimesheets, ...teamTimesheets].map((timesheet) => timesheet.id);
  const entryCounts = new Map<string, number>();
  if (allIds.length > 0) {
    const { data: entryRows } = await db
      .from("time_entries")
      .select("timesheet_id")
      .in("timesheet_id", allIds);
    for (const entry of entryRows ?? []) {
      const timesheetId = entry.timesheet_id as string;
      entryCounts.set(timesheetId, (entryCounts.get(timesheetId) ?? 0) + 1);
    }
  }

  const teamEmployeeIds = [...new Set(teamTimesheets.map((timesheet) => timesheet.employee_id))];
  const nameById = new Map<string, string>();
  if (teamEmployeeIds.length > 0) {
    const { data: people } = await db
      .from("profiles")
      .select("id, full_name, email")
      .in("id", teamEmployeeIds);
    for (const person of (people ?? []) as Pick<Profile, "id" | "full_name" | "email">[]) {
      nameById.set(person.id, person.full_name?.trim() || person.email);
    }
  }

  const toListRows = (timesheets: Row[], includeTeamNames: boolean): TimesheetListRow[] =>
    timesheets.map((timesheet) => ({
      id: timesheet.id,
      org_id: timesheet.org_id,
      employee_id: timesheet.employee_id,
      employeeName: includeTeamNames
        ? (nameById.get(timesheet.employee_id) ?? "—")
        : (profile.full_name?.trim() || profile.email),
      orgName: undefined,
      period_start: timesheet.period_start,
      period_end: timesheet.period_end,
      rowCount: entryCounts.get(timesheet.id) ?? timesheet.rows?.[0]?.count ?? 0,
      status: timesheet.status as TimesheetStatus,
      submitted_at: timesheet.submitted_at,
      created_at: timesheet.created_at,
      calculated_total: timesheet.calculated_total,
      currency_snapshot: timesheet.currency_snapshot,
      rejection_note: timesheet.rejection_note,
      has_overtime: timesheet.has_overtime,
      overtime_hours: timesheet.overtime_hours,
      edit_request_status:
        (timesheet.edit_request_status as "pending" | "approved" | "rejected" | null) ?? null,
      edit_request_note: timesheet.edit_request_note,
    }));

  const myRows = toListRows(myTimesheets, false);
  const teamRows = toListRows(teamTimesheets, true);

  const reminderTimesheet = myRows.find((timesheet) =>
    computeTimesheetLifecycle({
      status: timesheet.status,
      periodEnd: timesheet.period_end,
      submittedAt: timesheet.submitted_at,
      editRequestStatus: timesheet.edit_request_status,
    }).showReminderBanner,
  );

  return (
    <div>
      <PageHeader
        title="Timesheets"
        description="Your own timesheet history in the active workspace."
        action={<TimesheetPageActions showExport showLogTime />}
      />

      {reminderTimesheet && (
        <Card className="mb-4 border-[var(--accent)]">
          <CardContent className="py-4 text-sm text-ink">
            Submission reminder: period{" "}
            <span className="tabular font-semibold">
              {reminderTimesheet.period_start} – {reminderTimesheet.period_end}
            </span>{" "}
            is now within the 3-day submission window.
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent>
          <TimesheetFilters
            status={statusFilter}
            employee=""
            employees={[]}
            from={fromFilter}
            to={toFilter}
            org=""
            orgs={[]}
            isSuperadmin={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My timesheets</CardTitle>
          <CardDescription>
            {myRows.length} {myRows.length === 1 ? "timesheet" : "timesheets"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {myRows.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No timesheets yet"
                description="Your saved periods will appear here."
              />
            </div>
          ) : (
            <TimesheetListTable
              timesheets={myRows}
              isManager={false}
              isSuperadmin={false}
              currentUserId={profile.id}
              currentUserRole={profile.role}
              currentUserOrgId={profile.org_id}
              sort={sort}
              dir={dir}
            />
          )}
        </CardContent>
      </Card>

      {showTeamSection && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Team approvals</CardTitle>
            <CardDescription>
              Separate queue for team submissions and edit requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden p-0">
            {teamRows.length === 0 ? (
              <div className="px-6 py-10">
                <EmptyState
                  title="No team timesheets yet"
                  description="Team submissions will appear here."
                />
              </div>
            ) : (
              <TimesheetListTable
                timesheets={teamRows}
                isManager
                isSuperadmin={false}
                currentUserId={profile.id}
                currentUserRole={profile.role}
                currentUserOrgId={profile.org_id}
                sort={sort}
                dir={dir}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
