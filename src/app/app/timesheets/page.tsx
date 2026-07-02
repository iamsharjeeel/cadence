import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWorkspaceContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile, Timesheet, TimesheetStatus } from "@/types/db";
import { TimesheetFilters } from "./controls";
import { TimesheetListTable, type TimesheetListRow } from "./TimesheetListTable";
import { TimeLogReminder } from "./TimeLogReminder";
import { TimesheetPageActions } from "./TimesheetPageActions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Timesheets" };
}

type Row = Timesheet & { rows: { count: number }[] };
type SortKey = "period" | "total" | "submitted";

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    employee?: string;
    from?: string;
    to?: string;
    org?: string;
    sort?: string;
    dir?: string;
  };
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  const profile = ctx.effectiveProfile;
  const isSuperadmin = ctx.isSuperadmin;
  const isOrgManager =
    Boolean(ctx.activeOrgId) &&
    (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin");
  const isManager = isSuperadmin || isOrgManager;

  const statusFilter = (searchParams.status ?? "") as TimesheetStatus | "";
  const employeeFilter = searchParams.employee ?? "";
  const fromFilter = searchParams.from ?? "";
  const toFilter = searchParams.to ?? "";
  const orgFilter = isSuperadmin ? searchParams.org ?? "" : "";
  const sort = (searchParams.sort ?? "period") as SortKey;
  const dir = searchParams.dir === "asc" ? "asc" : "desc";

  const db = isSuperadmin ? createAdminClient() : createClient();
  let query = db
    .from("timesheets")
    .select("*, rows:timesheet_rows(count)");

  if (!isManager) query = query.eq("employee_id", profile.id);
  else if (!isSuperadmin && ctx.activeOrgId) query = query.eq("org_id", ctx.activeOrgId);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (isManager && employeeFilter) query = query.eq("employee_id", employeeFilter);
  if (orgFilter) query = query.eq("org_id", orgFilter);
  if (fromFilter) query = query.gte("period_start", fromFilter);
  if (toFilter) query = query.lte("period_end", toFilter);

  if (sort === "total") {
    query = query.order("calculated_total", {
      ascending: dir === "asc",
      nullsFirst: false,
    });
  } else if (sort === "submitted") {
    query = query.order("created_at", { ascending: dir === "asc" });
  } else {
    query = query.order("period_start", { ascending: dir === "asc" });
  }

  const { data } = await query;
  const timesheets = (data ?? []) as Row[];

  const entryCounts = new Map<string, number>();
  if (timesheets.length > 0) {
    const ids = timesheets.map((t) => t.id);
    const { data: entryRows } = await db
      .from("time_entries")
      .select("timesheet_id")
      .in("timesheet_id", ids);
    for (const e of entryRows ?? []) {
      entryCounts.set(
        e.timesheet_id as string,
        (entryCounts.get(e.timesheet_id as string) ?? 0) + 1,
      );
    }
  }

  const nameById = new Map<string, string>();
  let employeeOptions: { id: string; name: string }[] = [];
  let orgOptions: { id: string; name: string }[] = [];
  const orgNameById = new Map<string, string>();

  if (isManager) {
    const pdb = isSuperadmin ? createAdminClient() : createClient();
    let pq = pdb.from("profiles").select("id, full_name, email");
    if (!isSuperadmin && ctx.activeOrgId) pq = pq.eq("org_id", ctx.activeOrgId);
    const { data: people } = await pq;
    for (const p of (people ?? []) as Pick<
      Profile,
      "id" | "full_name" | "email"
    >[]) {
      const name = p.full_name?.trim() || p.email;
      nameById.set(p.id, name);
      employeeOptions.push({ id: p.id, name });
    }
    employeeOptions.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (isSuperadmin) {
    const { data: orgs } = await createAdminClient()
      .from("organizations")
      .select("id, name")
      .order("name");
    for (const o of (orgs ?? []) as Pick<Organization, "id" | "name">[]) {
      orgNameById.set(o.id, o.name);
      orgOptions.push({ id: o.id, name: o.name });
    }
  }

  const listRows: TimesheetListRow[] = timesheets.map((t) => ({
    id: t.id,
    org_id: t.org_id,
    employee_id: t.employee_id,
    employeeName: nameById.get(t.employee_id) ?? "—",
    orgName: orgNameById.get(t.org_id),
    period_start: t.period_start,
    period_end: t.period_end,
    rowCount: entryCounts.get(t.id) ?? t.rows?.[0]?.count ?? 0,
    status: t.status as TimesheetStatus,
    created_at: t.created_at,
    calculated_total: t.calculated_total,
    currency_snapshot: t.currency_snapshot,
    rejection_note: t.rejection_note,
    has_overtime: t.has_overtime,
    overtime_hours: t.overtime_hours,
  }));

  return (
    <div>
      {!isManager && <TimeLogReminder />}
      <PageHeader
        title="Timesheets"
        description={
          isManager
            ? "Review employee timesheets — including live drafts in progress."
            : "Your submitted and in-progress timesheets. Log time from the button above."
        }
        action={
          <TimesheetPageActions
            showExport={isManager}
            showLogTime
          />
        }
      />

      <Card className="mb-4">
        <CardContent>
          <TimesheetFilters
            status={statusFilter}
            employee={employeeFilter}
            employees={isManager ? employeeOptions : []}
            from={fromFilter}
            to={toFilter}
            org={orgFilter}
            orgs={orgOptions}
            isSuperadmin={isSuperadmin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isManager ? "All timesheets" : "Your timesheets"}</CardTitle>
          <CardDescription>
            {timesheets.length}{" "}
            {timesheets.length === 1 ? "timesheet" : "timesheets"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {timesheets.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No timesheets yet"
                description="Submitted and draft timesheets will appear here."
                action={
                  <Link href="/app/timesheets/log">
                    <Button size="sm">Log time</Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <TimesheetListTable
              timesheets={listRows}
              isManager={isManager}
              isSuperadmin={isSuperadmin}
              currentUserId={profile.id}
              currentUserRole={profile.role}
              currentUserOrgId={profile.org_id}
              sort={sort}
              dir={dir}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
