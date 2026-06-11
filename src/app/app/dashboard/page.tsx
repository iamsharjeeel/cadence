import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import { OrgLogo } from "@/components/brand/OrgLogo";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TimesheetStatusPill } from "@/components/ui/Badge";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAdminDashboard,
  getEmployeeDashboard,
  getSuperadminOrgSummaries,
} from "@/lib/dashboard/queries";
import { formatDate } from "@/lib/utils";
import type { TimesheetStatus } from "@/types/db";
import { StatCard } from "./StatCard";
import { CurrencyTotalsDisplay } from "./CurrencyTotals";
import { HoursLineChart } from "./DashboardCharts";
import { AdminDashboardView } from "./AdminDashboardView";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { org?: string };
}) {
  const profile = await requireActiveProfile();
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  // Legacy ?org=<uuid> links → slug-based drill-down route.
  if (profile.role === "superadmin" && searchParams.org) {
    const db = createAdminClient();
    const { data: org } = await db
      .from("organizations")
      .select("slug")
      .eq("id", searchParams.org)
      .single();
    if (org?.slug) {
      redirect(`/app/orgs/${org.slug}/dashboard`);
    }
  }

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

        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                            {formatDate(t.period_start)} –{" "}
                            {formatDate(t.period_end)}
                          </span>
                          <TimesheetStatusPill
                            status={t.status as TimesheetStatus}
                          />
                        </Link>
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

  if (profile.role === "superadmin") {
    const orgs = await getSuperadminOrgSummaries();
    return (
      <div>
        <PageHeader
          title={`Good to see you, ${firstName}.`}
          description="Platform overview across all organizations."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/app/orgs/${org.slug}/dashboard`}
              className="block h-full"
            >
              <Card className="h-full transition-[box-shadow] duration-150 ease-out hover:shadow-lg">
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <OrgLogo
                        name={org.name}
                        logoUrl={org.logoUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="font-display text-lg font-semibold tracking-tightest">
                          {org.name}
                        </p>
                        <p className="text-xs text-muted">{org.slug}</p>
                      </div>
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
        </div>
      </div>
    );
  }

  // Org admin — own org dashboard on /app/dashboard.
  const db = createAdminClient();
  const { data: orgRow } = await db
    .from("organizations")
    .select("name, logo_url")
    .eq("id", profile.org_id!)
    .single();
  const data = await getAdminDashboard(profile.org_id!);
  return (
    <AdminDashboardView
      data={data}
      title="Team dashboard"
      description="Approved hours and payroll estimates for this month."
      orgName={orgRow?.name}
      orgLogoUrl={orgRow?.logo_url}
      timesheetsFilterHref="/app/timesheets?status=submitted"
    />
  );
}
