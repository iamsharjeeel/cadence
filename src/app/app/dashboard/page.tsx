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
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { Reveal } from "@/components/motion/Reveal";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAdminDashboard,
  getEmployeeDashboard,
  getSuperadminOrgSummaries,
} from "@/lib/dashboard/queries";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import type { TimesheetStatus } from "@/types/db";
import { StatCard } from "./StatCard";
import { CurrencyTotalsDisplay } from "./CurrencyTotals";
import { HoursBarChart, HoursLineChart } from "./DashboardCharts";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { org?: string };
}) {
  const profile = await requireActiveProfile();
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  if (profile.role === "employee") {
    const data = await getEmployeeDashboard(profile);
    return (
      <div>
        <PageHeader
          title={`Good to see you, ${firstName}.`}
          description="Your approved hours and earnings this month."
          action={
            <Link href="/app/timesheets/new">
              <Button size="sm">Submit new timesheet</Button>
            </Link>
          }
        />

        <Reveal className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Approved hours this month"
            value={data.approvedHoursMonth}
            decimals={1}
          />
          <Card>
            <CardContent className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">
                Total earnings this month
              </span>
              <CurrencyTotalsDisplay totals={data.earningsByCurrency} />
            </CardContent>
          </Card>
        </Reveal>

        <Reveal className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>My hours by period</CardTitle>
              <CardDescription>Last 6 approved pay periods.</CardDescription>
            </CardHeader>
            <CardContent>
              <HoursLineChart data={data.hoursByPeriod} xKey="label" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent timesheets</CardTitle>
              <CardDescription>Your last 5 submissions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentTimesheets.length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted">No timesheets yet.</p>
              ) : (
                <ul className="divide-y">
                  {data.recentTimesheets.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/app/timesheets/${t.id}`}
                        className="flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-[var(--accent-soft)]/30"
                      >
                        <span className="tnum text-sm text-ink">
                          {formatDate(t.period_start)} – {formatDate(t.period_end)}
                        </span>
                        <TimesheetStatusPill status={t.status as TimesheetStatus} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    );
  }

  if (profile.role === "superadmin" && !searchParams.org) {
    const orgs = await getSuperadminOrgSummaries();
    return (
      <div>
        <PageHeader
          title={`Good to see you, ${firstName}.`}
          description="Platform overview across all organizations."
        />

        <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Link key={org.id} href={`/app/dashboard?org=${org.id}`}>
              <Card className="h-full transition-shadow hover:shadow-lg motion-safe:hover:-translate-y-px">
                <CardContent className="flex flex-col gap-4">
                  <div>
                    <p className="font-display text-lg font-semibold tracking-tightest">
                      {org.name}
                    </p>
                    <p className="text-xs text-muted">{org.slug}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted">
                        Employees
                      </span>
                      <p className="tnum font-semibold text-ink">
                        {org.employeeCount}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted">
                        Pending
                      </span>
                      <p className="tnum font-semibold text-ink">
                        {org.pendingCount}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs uppercase tracking-wide text-muted">
                        Approved hours (month)
                      </span>
                      <p className="tnum font-semibold text-ink">
                        {org.approvedHoursPeriod.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </Reveal>
      </div>
    );
  }

  const orgId =
    profile.role === "superadmin"
      ? searchParams.org!
      : profile.org_id!;

  if (profile.role === "superadmin") {
    const db = createAdminClient();
    const { data: org } = await db
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();
    if (!org) {
      return (
        <div>
          <PageHeader title="Organization not found" />
          <Link href="/app/dashboard">
            <Button variant="ghost" size="sm">
              Back to platform overview
            </Button>
          </Link>
        </div>
      );
    }
  }

  const data = await getAdminDashboard(orgId);
  const orgLabel =
    profile.role === "superadmin" ? "Organization" : "Team";

  return (
    <div>
      <PageHeader
        title={`${orgLabel} dashboard`}
        description="Approved hours and payroll estimates for this month."
        action={
          <div className="flex flex-wrap gap-2">
            {profile.role === "superadmin" && (
              <Link href="/app/dashboard">
                <Button variant="ghost" size="sm">
                  All orgs
                </Button>
              </Link>
            )}
            <Link href="/app/timesheets?status=submitted">
              <Button size="sm">
                Pending approvals
                {data.pendingCount > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-xs tnum">
                    {data.pendingCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        }
      />

      <Reveal className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending approvals" value={data.pendingCount} />
        <StatCard
          label="Approved hours this month"
          value={data.approvedHoursPeriod}
          decimals={1}
        />
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Payroll estimate
            </span>
            <CurrencyTotalsDisplay totals={data.payrollByCurrency} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hours by employee</CardTitle>
            <CardDescription>Approved hours this month.</CardDescription>
          </CardHeader>
          <CardContent>
            <HoursBarChart data={data.hoursByEmployee} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weekly trend</CardTitle>
            <CardDescription>Approved hours over the last 8 weeks.</CardDescription>
          </CardHeader>
          <CardContent>
            <HoursLineChart
              data={data.weeklyTrend.map((w) => ({
                label: w.week.replace("-W", " W"),
                hours: w.hours,
              }))}
            />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Employee breakdown</CardTitle>
            <CardDescription>Approved hours and estimated totals.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Role</TH>
                  <TH>Rate</TH>
                  <TH>Hours</TH>
                  <TH>Est. total</TH>
                </TR>
              </THead>
              <TBody>
                {data.employeeBreakdown.map((e) => (
                  <TR key={e.id}>
                    <TD className="text-sm font-medium">{e.name}</TD>
                    <TD className="text-sm text-muted">{titleCase(e.role)}</TD>
                    <TD className="tnum text-sm">
                      {e.rate !== null
                        ? formatMoney(e.rate, e.currency)
                        : "—"}
                    </TD>
                    <TD className="tnum text-sm">
                      {e.approvedHours.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </TD>
                    <TD className="tnum text-sm">
                      {e.estimatedTotal > 0
                        ? formatMoney(e.estimatedTotal, e.currency)
                        : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Last 10 audit log entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.recentActivity.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-col gap-0.5 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="text-sm font-medium text-ink">
                      {a.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted">
                      {a.actorName} · {formatDate(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
