import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Profile, Timesheet, TimesheetStatus } from "@/types/db";
import {
  ApproveTimesheetButton,
  RejectTimesheetControl,
  TimesheetFilters,
} from "./controls";

export const metadata: Metadata = { title: "Timesheets" };

type Row = Timesheet & { rows: { count: number }[] };

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: { status?: string; employee?: string };
}) {
  const profile = await requireActiveProfile();
  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const isSuperadmin = profile.role === "superadmin";

  const statusFilter = (searchParams.status ?? "") as TimesheetStatus | "";
  const employeeFilter = searchParams.employee ?? "";

  // Superadmin reads across all orgs (service-role); others via RLS session.
  const db = isSuperadmin ? createAdminClient() : createClient();
  let query = db
    .from("timesheets")
    .select("*, rows:timesheet_rows(count)")
    .order("period_start", { ascending: false });

  if (!isManager) query = query.eq("employee_id", profile.id);
  else if (!isSuperadmin) query = query.eq("org_id", profile.org_id!);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (isManager && employeeFilter) query = query.eq("employee_id", employeeFilter);

  const { data } = await query;
  const timesheets = (data ?? []) as Row[];

  // Build an employee name map + filter list for managers.
  const nameById = new Map<string, string>();
  let employeeOptions: { id: string; name: string }[] = [];
  if (isManager) {
    const pdb = isSuperadmin ? createAdminClient() : createClient();
    let pq = pdb.from("profiles").select("id, full_name, email");
    if (!isSuperadmin) pq = pq.eq("org_id", profile.org_id!);
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

  return (
    <div>
      <PageHeader
        title="Timesheets"
        description={
          isManager
            ? "Review submitted timesheets and approve or reject them."
            : "Your submitted and draft timesheets."
        }
        action={
          <Link href="/app/timesheets/new">
            <Button size="sm">New timesheet</Button>
          </Link>
        }
      />

      {isManager && (
        <Card className="mb-4">
          <CardContent>
            <TimesheetFilters
              status={statusFilter}
              employee={employeeFilter}
              employees={employeeOptions}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isManager ? "All timesheets" : "Your timesheets"}</CardTitle>
          <CardDescription>
            {timesheets.length}{" "}
            {timesheets.length === 1 ? "timesheet" : "timesheets"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {timesheets.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No timesheets yet"
                description={
                  isManager
                    ? "Submitted timesheets will appear here for review."
                    : "Create your first timesheet to get started."
                }
                action={
                  !isManager ? (
                    <Link href="/app/timesheets/new">
                      <Button size="sm">New timesheet</Button>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  {isManager && <TH>Employee</TH>}
                  <TH>Period</TH>
                  <TH>Rows</TH>
                  <TH>Status</TH>
                  <TH>Submitted</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {timesheets.map((t) => (
                  <TR key={t.id}>
                    {isManager && (
                      <TD className="text-sm font-medium text-ink">
                        {nameById.get(t.employee_id) ?? "—"}
                      </TD>
                    )}
                    <TD className="tnum text-sm">
                      {formatDate(t.period_start)} – {formatDate(t.period_end)}
                    </TD>
                    <TD className="tnum text-sm text-muted">
                      {t.rows?.[0]?.count ?? 0}
                    </TD>
                    <TD>
                      <TimesheetStatusPill
                        status={t.status as TimesheetStatus}
                      />
                    </TD>
                    <TD className="tnum text-sm text-muted">
                      {formatDate(t.created_at)}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2">
                        {isManager && t.status === "submitted" && (
                          <>
                            <ApproveTimesheetButton id={t.id} />
                            <RejectTimesheetControl id={t.id} />
                          </>
                        )}
                        <Link href={`/app/timesheets/${t.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
