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
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { Profile, TimesheetStatus } from "@/types/db";
import { getEmployeeDashboard } from "@/lib/dashboard/queries";
import { StatCard } from "./StatCard";
import { CurrencyTotalsDisplay } from "./CurrencyTotals";
import { HoursLineChart } from "./DashboardCharts";

export async function EmployeeDashboardContent({
  profile,
  firstName,
  extraAction,
}: {
  profile: Profile;
  firstName: string;
  extraAction?: React.ReactNode;
}) {
  const data = await getEmployeeDashboard(profile);

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}.`}
        description="Your approved hours and earnings this month."
        greeting
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/timesheets/log">
              <Button size="sm">Log time</Button>
            </Link>
            {extraAction}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard
          label="Approved hours this month"
          value={data.approvedHoursMonth}
          decimals={1}
        />
        <Card
          density="comfortable"
          className="min-w-0 overflow-hidden dark:border dark:border-[var(--line)] dark:bg-[var(--surface)] dark:shadow-none"
        >
          <CardContent className="flex flex-col gap-0 py-6">
            <span className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-muted sm:text-[11px] dark:text-[var(--ink-muted)]">
              Total earnings this month
            </span>
            <div className="py-4">
              <CurrencyTotalsDisplay totals={data.earningsByCurrency} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card density="comfortable">
          <CardHeader>
            <CardTitle className="text-[18px] font-semibold">My hours by period</CardTitle>
            <CardDescription>Last 6 approved pay periods.</CardDescription>
          </CardHeader>
          <CardContent>
            <HoursLineChart data={data.hoursByPeriod} xKey="label" />
          </CardContent>
        </Card>

        <Card density="comfortable">
          <CardHeader>
            <CardTitle className="text-[18px] font-semibold">Recent timesheets</CardTitle>
            <CardDescription>Your last 5 submissions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentTimesheets.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted">No timesheets yet.</p>
            ) : (
              <ul>
                {data.recentTimesheets.map((t) => (
                  <li key={t.id} className="odd:bg-surface-low">
                    <Link
                      href={`/app/timesheets/${t.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-[var(--accent-soft)]/30"
                    >
                      <span className="tabular text-sm text-ink">
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
      </div>
    </>
  );
}
