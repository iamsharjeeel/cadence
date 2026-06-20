"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CountUp } from "@/components/motion/CountUp";
import { heatmapCellColor, useChartColors } from "@/lib/chart-colors";

type EmployeeTrends = Awaited<
  ReturnType<typeof import("@/lib/time/trends").getEmployeeTrends>
>;
type AdminTrends = Awaited<
  ReturnType<typeof import("@/lib/time/trends").getAdminTrends>
>;

export function EmployeeTrendsView({ data }: { data: EmployeeTrends }) {
  const { resolvedTheme } = useTheme();
  const colors = useChartColors();
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dark = resolvedTheme === "dark";

  const hasData =
    data.billableHours > 0 ||
    data.nonBillableHours > 0 ||
    (data.periodLine ?? []).some((p) => p.hours > 0);

  if (!hasData) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-5 w-5" />}
        title="No trend data yet"
        description="Log and submit time entries to see your hours, projects, and activity trends here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Avg hours / day" value={data.avgHoursPerDay} suffix="h" />
        <Stat label="Top project" value={0} text={data.topProject} />
        <Stat label="Billable hours" value={data.billableHours} suffix="h" />
        <Stat label="Non-billable" value={data.nonBillableHours} suffix="h" />
      </div>

      <TrendLineChart
        data={data.periodLine}
        primary={colors.primary}
        grid={colors.grid}
        tick={colors.tick}
        strokeWidth={colors.lineStrokeWidth}
        animate={!reducedMotion}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendBarChart
          title="Hours by project"
          data={data.projectBars}
          dataKey="hours"
          nameKey="name"
          fill="var(--accent-mid)"
          grid={colors.grid}
          tick="var(--ink-muted)"
          animate={!reducedMotion}
        />
        <TrendBarChart
          title="Hours by day of week"
          data={data.dayOfWeek}
          dataKey="hours"
          nameKey="day"
          fill="var(--accent-mid)"
          grid={colors.grid}
          tick="var(--ink-muted)"
          animate={!reducedMotion}
        />
      </div>

      <Card density="comfortable">
        <CardHeader>
          <CardTitle>Activity heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <HeatmapGrid data={data.heatmap} dark={dark} />
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminTrendsView({
  orgData,
  adminData,
}: {
  orgData: EmployeeTrends;
  adminData: AdminTrends;
}) {
  const colors = useChartColors();
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hasOrgData =
    adminData.totalHours > 0 || (adminData.stackedEmployees ?? []).length > 0;

  if (!hasOrgData) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-5 w-5" />}
        title="No team trend data yet"
        description="Once your team logs and submits time, organisation-wide trends and per-employee breakdowns will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <EmployeeTrendsView data={orgData} />

      <Card density="comfortable">
        <CardHeader>
          <CardTitle>Hours by employee (last 8 periods)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={adminData.stackedBar}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 12,
                  fill: "var(--ink-muted)",
                  fontFamily: "var(--font-inter)",
                }}
              />
              <YAxis
                tick={{
                  fontSize: 12,
                  fill: "var(--ink-muted)",
                  fontFamily: "var(--font-inter)",
                }}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-inter)" }} />
              {adminData.stackedEmployees.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="hours"
                  fill={
                    i === 0
                      ? "var(--accent-mid)"
                      : i === 1
                        ? "var(--ink-muted)"
                        : colors.palette[i % colors.palette.length]
                  }
                  radius={i === adminData.stackedEmployees.length - 1 ? [4, 4, 0, 0] : undefined}
                  isAnimationActive={!reducedMotion}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card density="comfortable">
        <CardHeader>
          <CardTitle>Org total hours</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display font-bold tabular text-ink">
            <CountUp value={adminData.totalHours} decimals={1} />h
          </p>
          <p className="mt-1 text-sm text-muted">In selected range</p>
        </CardContent>
      </Card>
    </div>
  );
}

function TrendLineChart({
  data,
  primary,
  grid,
  tick,
  strokeWidth,
  animate,
}: {
  data: { label: string; hours: number }[];
  primary: string;
  grid: string;
  tick: string;
  strokeWidth: number;
  animate: boolean;
}) {
  return (
    <Card density="comfortable">
      <CardHeader>
        <CardTitle>Hours by period</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis
              dataKey="label"
              tick={{
                fontSize: 12,
                fill: tick,
                fontFamily: "var(--font-inter)",
              }}
            />
            <YAxis
              tick={{
                fontSize: 12,
                fill: tick,
                fontFamily: "var(--font-inter)",
              }}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="hours"
              stroke={primary}
              strokeWidth={strokeWidth}
              dot={false}
              isAnimationActive={animate}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TrendBarChart({
  title,
  data,
  dataKey,
  nameKey,
  fill,
  grid,
  tick,
  animate,
}: {
  title: string;
  data: Record<string, string | number>[];
  dataKey: string;
  nameKey: string;
  fill: string;
  grid: string;
  tick: string;
  animate: boolean;
}) {
  return (
    <Card density="comfortable">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis
              dataKey={nameKey}
              tick={{
                fontSize: 12,
                fill: tick,
                fontFamily: "var(--font-inter)",
              }}
            />
            <YAxis
              tick={{
                fontSize: 12,
                fill: tick,
                fontFamily: "var(--font-inter)",
              }}
            />
            <Tooltip />
            <Bar
              dataKey={dataKey}
              fill={fill}
              radius={[4, 4, 0, 0]}
              isAnimationActive={animate}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function HeatmapGrid({
  data,
  dark,
}: {
  data: { date: string; hours: number }[];
  dark?: boolean;
}) {
  const weeks = useMemo(() => {
    const byWeek = new Map<number, { date: string; hours: number }[]>();
    for (const d of data) {
      const dt = new Date(d.date);
      const week = Math.floor(
        (dt.getTime() - new Date(data[0]?.date ?? d.date).getTime()) /
          (7 * 86_400_000),
      );
      const list = byWeek.get(week) ?? [];
      list.push(d);
      byWeek.set(week, list);
    }
    return [...byWeek.values()];
  }, [data]);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.hours.toFixed(1)}h`}
                className="h-3 w-3 rounded-none"
                style={{
                  backgroundColor: heatmapCellColor(d.hours, dark),
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  text,
}: {
  label: string;
  value: number;
  suffix?: string;
  text?: string;
}) {
  return (
    <Card
      density="comfortable"
      className="min-w-0 overflow-hidden dark:border dark:border-[var(--line)] dark:bg-[var(--surface)] dark:shadow-none"
    >
      <CardContent className="flex flex-col gap-0 py-6">
        <p className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-muted sm:text-[11px] dark:text-[var(--ink-muted)]">
          {label}
        </p>
        <p className="truncate py-4 font-display text-3xl font-bold leading-none tabular text-[var(--accent)] sm:text-4xl lg:text-6xl">
          {text ?? (
            <>
              <CountUp value={value} decimals={1} />
              {suffix}
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
