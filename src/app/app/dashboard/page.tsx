import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { hasAsanaConnection } from "@/lib/asana/connection";
import { hasGCalConnection } from "@/lib/google-calendar/connection";
import { AsanaConnectBanner } from "@/components/asana/AsanaConnectBanner";
import { AsanaConnectionHealthCheck } from "@/components/asana/AsanaConnectionHealthCheck";
import { PageHeader } from "@/components/app/PageHeader";
import { OrgLogo } from "@/components/brand/OrgLogo";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWorkspaceContext } from "@/lib/workspace";
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
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const profile = ctx.effectiveProfile;
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  const showAsanaConnectBanner = !ctx.isSuperadmin
    ? await Promise.all([
        hasAsanaConnection(profile.id),
        hasGCalConnection(profile.id),
      ]).then(([asanaConnected, gcalConnected]) => !asanaConnected || !gcalConnected)
    : false;
  const dashboardPrompts = !ctx.isSuperadmin ? (
    <>
      <AsanaConnectBanner show={showAsanaConnectBanner} />
      <AsanaConnectionHealthCheck />
    </>
  ) : null;

  // ── Superadmin: platform oversight (across all orgs) ──────────────────
  if (ctx.isSuperadmin) {
    // Legacy ?org=<uuid> links → slug-based drill-down route.
    if (searchParams.org) {
      const db = createAdminClient();
      const { data: org } = await db
        .from("organizations")
        .select("slug")
        .eq("id", searchParams.org)
        .single();
      if (org?.slug) redirect(`/app/orgs/${org.slug}/dashboard`);
    }

    const orgs = await getSuperadminOrgSummaries();
    return (
      <div className="bg-background">
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
              <Card
                density="comfortable"
                className="h-full transition-[box-shadow] duration-150 ease-out hover:shadow-lg"
              >
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
                        Members
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
          {orgs.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                title="No organizations yet"
                description="Create an organization to manage teams and approvals."
                action={
                  <Link href="/app/organizations">
                    <Button size="sm">Manage organizations</Button>
                  </Link>
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Org owner/admin: team dashboard for the active org ────────────────
  if (ctx.activeOrg && ctx.workspaceRole !== "employee") {
    const data = await getAdminDashboard(ctx.activeOrgId);
    return (
      <div className="bg-background">
        {dashboardPrompts}
        <AdminDashboardView
          data={data}
          title="Team dashboard"
          description="Approved hours and payroll estimates for this month."
          orgName={ctx.activeOrg.name}
          orgLogoUrl={ctx.activeOrg.logoUrl}
          timesheetsFilterHref="/app/timesheets?status=submitted"
        />
      </div>
    );
  }

  // ── Personal or org employee: own solo view ───────────────────────────
  return (
    <div className="bg-background">
      {dashboardPrompts}
      <EmployeeDashboardContent
        profile={profile}
        firstName={firstName}
        includeTrendsSection={ctx.isPersonal}
      />
    </div>
  );
}
