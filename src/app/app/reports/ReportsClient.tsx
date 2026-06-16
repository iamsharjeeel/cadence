"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { fieldBase } from "@/components/ui/Input";
import { useChartColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import type {
  OrgReportData,
  PersonalReportData,
  ReportDatePreset,
} from "@/lib/reports/queries";
import { fetchOrgReport, fetchPersonalReport } from "./reports-actions";

const PRESETS: { id: ReportDatePreset; label: string }[] = [
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "custom", label: "Custom" },
];

function hoursLabel(h: number): string {
  return `${h.toFixed(1)}h`;
}

function exportOrgCsv(data: OrgReportData, rangeLabel: string) {
  const lines = [
    `Organization report,${rangeLabel}`,
    "",
    "Member,Email,Hours,Billable %,Utilization %",
    ...data.byMember.map(
      (m) =>
        `"${m.name}","${m.email}",${m.hours.toFixed(2)},${m.billablePct},${m.utilizationPct}`,
    ),
    "",
    "Project,Hours,Billable hours",
    ...data.byProject.map(
      (p) => `"${p.name}",${p.hours.toFixed(2)},${p.billableHours.toFixed(2)}`,
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `org-report-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient({
  initialPersonal,
  initialOrg,
  showOrgTab,
  initialPreset,
}: {
  initialPersonal: PersonalReportData;
  initialOrg: OrgReportData | null;
  showOrgTab: boolean;
  initialPreset: ReportDatePreset;
}) {
  const colors = useChartColors();
  const [tab, setTab] = useState<"personal" | "org">("personal");
  const [preset, setPreset] = useState<ReportDatePreset>(initialPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [personal, setPersonal] = useState(initialPersonal);
  const [org, setOrg] = useState<OrgReportData | null>(initialOrg);
  const [pending, startTransition] = useTransition();

  const chartData = useMemo(
    () =>
      personal.byProject.slice(0, 8).map((p) => ({
        name: p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name,
        hours: Number(p.hours.toFixed(2)),
      })),
    [personal.byProject],
  );

  function reload(nextPreset: ReportDatePreset, from?: string, to?: string) {
    setPreset(nextPreset);
    startTransition(async () => {
      const p = await fetchPersonalReport(nextPreset, from, to);
      setPersonal(p);
      if (showOrgTab) {
        const o = await fetchOrgReport(nextPreset, from, to);
        if (!("error" in o)) setOrg(o);
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("personal")}
          className={cn(
            "rounded-full px-3 py-1 text-sm transition-colors",
            tab === "personal"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border text-muted hover:text-ink",
          )}
        >
          Personal
        </button>
        {showOrgTab && (
          <button
            type="button"
            onClick={() => setTab("org")}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              tab === "org"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border text-muted hover:text-ink",
            )}
          >
            Organization
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() => {
              if (p.id !== "custom") reload(p.id);
              else setPreset("custom");
            }}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              preset === p.id
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border text-muted hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={cn(fieldBase, "h-9 w-auto text-sm")}
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={cn(fieldBase, "h-9 w-auto text-sm")}
            />
            <Button
              size="sm"
              disabled={pending || !customFrom || !customTo}
              onClick={() => reload("custom", customFrom, customTo)}
            >
              Apply
            </Button>
          </>
        )}
      </div>

      {tab === "personal" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total hours" value={hoursLabel(personal.totalHours)} />
            <StatCard
              label="Billable"
              value={hoursLabel(personal.billableHours)}
            />
            <StatCard
              label="Non-billable"
              value={hoursLabel(personal.nonBillableHours)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By project</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted">No time logged in this range.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid stroke={colors.grid} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: colors.tick, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: colors.tick, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="hours"
                        fill={colors.primary}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-hidden p-0">
              <Table className="border-0">
                <THead>
                  <TR>
                    <TH>Project</TH>
                    <TH className="text-right">Hours</TH>
                  </TR>
                </THead>
                <TBody>
                  {personal.byProject.map((p) => (
                    <TR key={p.projectId ?? "none"}>
                      <TD>{p.name}</TD>
                      <TD className="tabular text-right">
                        {hoursLabel(p.hours)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : org ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <StatCard label="Total org hours" value={hoursLabel(org.totalHours)} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportOrgCsv(org, preset)}
            >
              Export CSV
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By member</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              <Table className="border-0">
                <THead>
                  <TR>
                    <TH>Member</TH>
                    <TH className="text-right">Hours</TH>
                    <TH className="text-right">Billable %</TH>
                    <TH className="text-right">Utilization %</TH>
                  </TR>
                </THead>
                <TBody>
                  {org.byMember.map((m) => (
                    <TR key={m.memberId}>
                      <TD>
                        <p className="text-sm font-medium text-ink">{m.name}</p>
                        <p className="text-xs text-muted">{m.email}</p>
                      </TD>
                      <TD className="tabular text-right">
                        {hoursLabel(m.hours)}
                      </TD>
                      <TD className="tabular text-right">{m.billablePct}%</TD>
                      <TD className="tabular text-right">
                        {m.utilizationPct}%
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By project</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              <Table className="border-0">
                <THead>
                  <TR>
                    <TH>Project</TH>
                    <TH className="text-right">Hours</TH>
                    <TH className="text-right">Billable hours</TH>
                  </TR>
                </THead>
                <TBody>
                  {org.byProject.map((p) => (
                    <TR key={p.projectId ?? "none"}>
                      <TD>{p.name}</TD>
                      <TD className="tabular text-right">
                        {hoursLabel(p.hours)}
                      </TD>
                      <TD className="tabular text-right">
                        {hoursLabel(p.billableHours)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted">Organization report unavailable.</p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="mt-1 font-display text-2xl tabular-nums text-ink">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
