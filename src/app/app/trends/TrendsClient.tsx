"use client";

import { useState, useTransition } from "react";

import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { fieldBase } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { TrendRange, TrendsBundle } from "@/lib/time/trends";
import { AdminTrendsView, EmployeeTrendsView } from "./TrendsCharts";
import { fetchTrendsData } from "./trends-actions";

const RANGES: TrendRange[] = [
  "weekly",
  "fortnightly",
  "monthly",
  "6month",
  "yearly",
];

function rangeLabel(r: TrendRange): string {
  if (r === "6month") return "6 months";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function TrendsClient({
  initialRange,
  initialOrgId,
  initialData,
  orgs,
  isManager,
  isSuperadmin,
}: {
  initialRange: TrendRange;
  initialOrgId: string;
  initialData: TrendsBundle;
  orgs: { id: string; name: string }[];
  isManager: boolean;
  isSuperadmin: boolean;
}) {
  const [range, setRange] = useState<TrendRange>(initialRange);
  const [orgId, setOrgId] = useState(initialOrgId);
  const [data, setData] = useState<TrendsBundle>(initialData);
  const [pending, startTransition] = useTransition();

  function applyFilters(nextRange: TrendRange, nextOrg: string) {
    setRange(nextRange);
    setOrgId(nextOrg);

    // Keep the URL shareable without triggering a navigation / full reload.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams();
      params.set("range", nextRange);
      if (nextOrg) params.set("org", nextOrg);
      window.history.replaceState(null, "", `?${params.toString()}`);
    }

    startTransition(async () => {
      const result = await fetchTrendsData(nextRange, nextOrg || undefined);
      setData(result);
    });
  }

  const { personalTrends, orgAggregateData, adminData } = data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => applyFilters(r, orgId)}
            aria-pressed={range === r}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              range === r
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border text-muted hover:text-ink",
            )}
          >
            {rangeLabel(r)}
          </button>
        ))}
      </div>

      {isSuperadmin && (
        <div className="mb-6 max-w-md">
          <select
            value={orgId}
            onChange={(e) => applyFilters(range, e.target.value)}
            className={cn(fieldBase, "appearance-none")}
          >
            <option value="">Select an organisation…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        className={cn(
          "transition-opacity duration-150",
          pending && "pointer-events-none opacity-60",
        )}
        aria-busy={pending}
      >
        {personalTrends && !isManager && (
          <EmployeeTrendsView data={personalTrends} />
        )}

        {isManager && orgAggregateData && adminData ? (
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
            <Card density="comfortable" className="mt-6">
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
                      <TR key={e.name}>
                        <TD>{e.name}</TD>
                        <TD className="tabular dark:text-[var(--accent)]">
                          {e.hours.toFixed(1)}
                        </TD>
                        <TD className="tabular dark:text-[var(--accent)]">
                          {e.billablePct}%
                        </TD>
                        <TD>{e.topProject}</TD>
                        <TD className="tabular dark:text-[var(--accent)]">
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
        ) : null}

        {isManager && isSuperadmin && !orgId && (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
            Select an organisation to view its trends.
          </p>
        )}
      </div>
    </div>
  );
}
