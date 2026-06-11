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
import type { AdminDashboardData } from "@/lib/dashboard/queries";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import { StatCard } from "./StatCard";
import { CurrencyTotalsDisplay } from "./CurrencyTotals";
import { HoursBarChart, HoursLineChart } from "./DashboardCharts";

export function AdminDashboardView({
  data,
  title,
  description,
  orgName,
  showSuperadminNav = false,
  timesheetsFilterHref = "/app/timesheets?status=submitted",
}: {
  data: AdminDashboardData;
  title: string;
  description: string;
  orgName?: string;
  showSuperadminNav?: boolean;
  timesheetsFilterHref?: string;
}) {
  return (
    <div>
      {showSuperadminNav && (
        <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
          <Link
            href="/app/dashboard"
            className="font-medium text-[var(--accent-strong)] hover:underline"
          >
            All organizations
          </Link>
          {orgName && (
            <>
              <span className="mx-2">/</span>
              <span className="text-ink">{orgName}</span>
            </>
          )}
        </nav>
      )}

      <PageHeader
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap gap-2">
            {showSuperadminNav && (
              <Link href="/app/dashboard">
                <Button variant="ghost" size="sm">
                  All orgs
                </Button>
              </Link>
            )}
            <Link href={timesheetsFilterHref}>
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

      <div className="grid gap-4 sm:grid-cols-3">
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
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
            <CardDescription>
              Approved hours over the last 8 weeks.
            </CardDescription>
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
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Employee breakdown</CardTitle>
            <CardDescription>
              Approved hours and estimated totals.
            </CardDescription>
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
      </div>
    </div>
  );
}
