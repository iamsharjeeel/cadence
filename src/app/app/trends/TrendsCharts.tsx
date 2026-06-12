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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CountUp } from "@/components/motion/CountUp";

type EmployeeTrends = Awaited<
  ReturnType<typeof import("@/lib/time/trends").getEmployeeTrends>
>;
type AdminTrends = Awaited<
  ReturnType<typeof import("@/lib/time/trends").getAdminTrends>
>;

const CHART_COLORS = [
  "#1F8A8A",
  "#6B6F76",
  "#157070",
  "#2AA6A6",
  "#4A9E9E",
  "#8AB8B8",
  "#3D7A7A",
  "#5C636A",
];

export function EmployeeTrendsView({ data }: { data: EmployeeTrends }) {
  const { resolvedTheme } = useTheme();
  const primary = resolvedTheme === "dark" ? "#2AA6A6" : "#1F8A8A";
  const secondary = "#6B6F76";
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Avg hours / day" value={data.avgHoursPerDay} suffix="h" />
        <Stat label="Top project" value={0} text={data.topProject} />
        <Stat label="Billable hours" value={data.billableHours} suffix="h" />
        <Stat label="Non-billable" value={data.nonBillableHours} suffix="h" />
      </div>

      <TrendLineChart data={data.periodLine} primary={primary} animate={!reducedMotion} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendBarChart
          title="Hours by project"
          data={data.projectBars}
          dataKey="hours"
          nameKey="name"
          fill={primary}
          animate={!reducedMotion}
        />
        <TrendBarChart
          title="Hours by day of week"
          data={data.dayOfWeek}
          dataKey="hours"
          nameKey="day"
          fill={secondary}
          animate={!reducedMotion}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <HeatmapGrid data={data.heatmap} dark={resolvedTheme === "dark"} />
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
  const { resolvedTheme } = useTheme();
  const primary = resolvedTheme === "dark" ? "#2AA6A6" : "#1F8A8A";
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="flex flex-col gap-6">
      <EmployeeTrendsView data={orgData} />

      <Card>
        <CardHeader>
          <CardTitle>Hours by employee (last 8 periods)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={adminData.stackedBar}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,21,26,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {adminData.stackedEmployees.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="hours"
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={i === adminData.stackedEmployees.length - 1 ? [4, 4, 0, 0] : undefined}
                  isAnimationActive={!reducedMotion}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Org total hours</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="tnum text-2xl font-semibold">
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
  animate,
}: {
  data: { label: string; hours: number }[];
  primary: string;
  animate: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours by period</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,21,26,0.08)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="hours"
              stroke={primary}
              strokeWidth={2}
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
  animate,
}: {
  title: string;
  data: Record<string, string | number>[];
  dataKey: string;
  nameKey: string;
  fill: string;
  animate: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,21,26,0.08)" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
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
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor:
                    d.hours === 0
                      ? "var(--line)"
                      : dark
                        ? `rgba(42,166,166,${Math.min(1, 0.15 + d.hours / 10)})`
                        : `rgba(31,138,138,${Math.min(1, 0.2 + d.hours / 10)})`,
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
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className="tnum mt-1 text-lg font-semibold">
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
