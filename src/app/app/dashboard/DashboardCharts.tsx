"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartColors } from "@/lib/chart-colors";

export function HoursBarChart({
  data,
}: {
  data: { name: string; hours: number }[];
}) {
  const colors = useChartColors();

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">No approved hours yet.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{
            fill: "var(--ink-muted)",
            fontSize: 12,
            fontFamily: "var(--font-inter)",
          }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{
            fill: "var(--ink-muted)",
            fontSize: 12,
            fontFamily: "var(--font-inter)",
          }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}
          formatter={(value) => [
            typeof value === "number" ? value.toFixed(1) : String(value ?? ""),
            "Hours",
          ]}
        />
        <Bar dataKey="hours" fill="var(--accent-mid)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HoursLineChart({
  data,
  dataKey = "hours",
  xKey = "label",
}: {
  data: Record<string, string | number>[];
  dataKey?: string;
  xKey?: string;
}) {
  const colors = useChartColors();

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">No data for this period.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{
            fill: "var(--ink-muted)",
            fontSize: 12,
            fontFamily: "var(--font-inter)",
          }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{
            fill: "var(--ink-muted)",
            fontSize: 12,
            fontFamily: "var(--font-inter)",
          }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}
          formatter={(value) => [
            typeof value === "number" ? value.toFixed(1) : String(value ?? ""),
            "Hours",
          ]}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="var(--accent-mid)"
          strokeWidth={2}
          dot={{ fill: "var(--accent-mid)", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
