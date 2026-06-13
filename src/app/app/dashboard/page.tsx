import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { hasAsanaConnection } from "@/lib/asana/connection";
import { AsanaConnectBanner } from "@/components/asana/AsanaConnectBanner";
import { AsanaConnectionHealthCheck } from "@/components/asana/AsanaConnectionHealthCheck";
import { PageHeader } from "@/components/app/PageHeader";
import { OrgLogo } from "@/components/brand/OrgLogo";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminDashboard, getSuperadminOrgSummaries } from "@/lib/dashboard/queries";
import { AdminDashboardView } from "./AdminDashboardView";
import { EmployeeDashboardContent } from "./EmployeeDashboardContent";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { org?: string };
}) {
  const profile = await requireActiveProfile();
  const firstName = profile.full_name?.split(" ")[0] ?? "there";
  const showAsanaConnectBanner =
    profile.org_id ? !(await hasAsanaConnection(profile.id)) : false;

  const dashboardPrompts = profile.org_id ? (
    <>
      <AsanaConnectBanner show={showAsanaConnectBanner} />
      <AsanaConnectionHealthCheck />
    </>
  ) : null;

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

  if (profile.role === "employee" && profile.org_id) {
    return (
      <div className="bg-background">
        {dashboardPrompts}
        <EmployeeDashboardContent profile={profile} firstName={firstName} />
      </div>
    );
  }

  if (profile.role === "superadmin") {
    const orgs = await getSuperadminOrgSummaries();

    if (profile.org_id) {
      return (
        <div className="flex flex-col gap-10 bg-background">
          {dashboardPrompts}
          <EmployeeDashboardContent
            profile={profile}
            firstName={firstName}
            extraAction={
              <Link href="/app/organizations">
                <Button variant="ghost" size="sm">
                  Platform overview
                </Button>
              </Link>
            }
          />
          <section>
            <h2 className="mb-4 font-display text-[18px] font-semibold tracking-tightest">
              Organizations
            </h2>
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
                        <OrgLogo name={org.name} logoUrl={org.logoUrl} size="md" />
                        <div className="min-w-0">
                          <p className="font-display text-lg font-semibold tracking-tightest">
                            {org.name}
                          </p>
                          <p className="text-xs text-muted">{org.slug}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                            Employees
                          </span>
                          <p className="font-display text-[42px] font-bold leading-none tabular text-ink dark:text-[var(--accent)]">
                            {org.employeeCount}
                          </p>
                        </div>
                        <div>
                          <span className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                            Pending
                          </span>
                          <p className="font-display text-[42px] font-bold leading-none tabular text-ink dark:text-[var(--accent)]">
                            {org.pendingCount}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="bg-background">
        {dashboardPrompts}
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
                        <span className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                          Employees
                        </span>
                        <p className="font-display text-[42px] font-bold leading-none tabular text-ink dark:text-[var(--accent)]">
                          {org.employeeCount}
                        </p>
                      </div>
                      <div>
                        <span className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                          Pending
                        </span>
                        <p className="font-display text-[42px] font-bold leading-none tabular text-ink dark:text-[var(--accent)]">
                          {org.pendingCount}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                          Approved hours (month)
                        </span>
                        <p className="font-display text-[42px] font-bold leading-none tabular text-ink dark:text-[var(--accent)]">
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
    <div className="bg-background">
      {dashboardPrompts}
      <AdminDashboardView
        data={data}
        title="Team dashboard"
        description="Approved hours and payroll estimates for this month."
        orgName={orgRow?.name}
        orgLogoUrl={orgRow?.logo_url}
        timesheetsFilterHref="/app/timesheets?status=submitted"
      />
    </div>
  );
}
