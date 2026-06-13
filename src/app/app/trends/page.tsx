import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { requireActiveProfile } from "@/lib/auth";
import {
  getAdminTrends,
  getEmployeeTrends,
  getOrgAggregateTrends,
  type TrendRange,
} from "@/lib/time/trends";
import { AdminTrendsView, EmployeeTrendsView } from "./TrendsCharts";
import { SuperadminOrgSelect } from "../settings/SuperadminOrgSelect";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureArray } from "@/lib/org-utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";

export const metadata: Metadata = { title: "Trends" };

const RANGES: TrendRange[] = ["weekly", "fortnightly", "monthly", "6month", "yearly"];

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: { range?: string; org?: string };
}) {
  const profile = await requireActiveProfile();
  const range = (RANGES.includes(searchParams.range as TrendRange)
    ? searchParams.range
    : "monthly") as TrendRange;
  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const isSuperadmin = profile.role === "superadmin";
  const orgId = isSuperadmin
    ? searchParams.org?.trim()
    : profile.org_id ?? undefined;

  let orgs: { id: string; name: string }[] = [];
  if (isSuperadmin) {
    const { data } = await createAdminClient()
      .from("organizations")
      .select("id, name")
      .order("name");
    orgs = ensureArray(data);
  }

  const personalTrends = profile.org_id
    ? await getEmployeeTrends(profile, range)
    : null;

  const orgAggregateData =
    isManager && (orgId || profile.org_id)
      ? await getOrgAggregateTrends(orgId ?? profile.org_id!, range)
      : null;

  const adminData =
    isManager && (orgId || profile.org_id)
      ? await getAdminTrends(orgId ?? profile.org_id!, range)
      : null;

  return (
    <div className="bg-background">
      <PageHeader
        title="Trends"
        description="Hours, projects, and patterns over time."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <a
            key={r}
            href={`?range=${r}${orgId ? `&org=${orgId}` : ""}`}
            className={`rounded-full px-3 py-1 text-sm ${
              range === r
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border text-muted hover:text-ink"
            }`}
          >
            {r === "6month" ? "6 months" : titleCase(r)}
          </a>
        ))}
      </div>

      {isSuperadmin && (
        <div className="mb-6 max-w-md">
          <Suspense fallback={null}>
            <SuperadminOrgSelect orgs={orgs} selectedOrgId={orgId ?? ""} />
          </Suspense>
        </div>
      )}

      {personalTrends && !isManager && (
        <EmployeeTrendsView data={personalTrends} />
      )}

      {isManager && orgAggregateData && adminData && (
        <>
          {personalTrends && (
            <section className="mb-8">
              <h2 className="mb-4 font-display text-lg font-semibold tracking-tightest">
                Your trends
              </h2>
              <EmployeeTrendsView data={personalTrends} />
            </section>
          )}
          <AdminTrendsView orgData={orgAggregateData} adminData={adminData} />
          <Card className="mt-6">
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Employee</TH>
                    <TH>Hours</TH>
                    <TH>Billable %</TH>
                    <TH>Top project</TH>
                    <TH>Est. earnings</TH>
                  </TR>
                </THead>
                <TBody>
                  {adminData.employeeRows.map((e) => (
                    <TR key={e.name} className="border-0 odd:bg-surface-low">
                      <TD>{e.name}</TD>
                      <TD className="tabular">{e.hours.toFixed(1)}</TD>
                      <TD className="tabular">{e.billablePct}%</TD>
                      <TD>{e.topProject}</TD>
                      <TD className="tabular">
                        {e.earnings != null
                          ? `${e.currency} ${e.earnings.toFixed(2)}`
                          : "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
