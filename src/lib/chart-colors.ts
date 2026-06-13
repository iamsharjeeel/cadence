"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export type ChartColors = {
  primary: string;
  secondary: string;
  grid: string;
  tick: string;
  /** Gold shades for multi-series charts — all derived from design tokens. */
  palette: string[];
  lineStrokeWidth: number;
};

function readCssVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function readChartColors(): ChartColors {
  const isDark = document.documentElement.classList.contains("dark");
  const primary = readCssVar("--accent-mid");
  const secondary = readCssVar("--ink-muted");
  const accentStrong = readCssVar("--accent-strong");
  const accentRgb = readCssVar("--accent-rgb");

  return {
    primary,
    secondary,
    grid: isDark ? "rgba(255,255,248,0.06)" : "rgba(26,25,23,0.06)",
    tick: secondary,
    lineStrokeWidth: isDark ? 1.5 : 2,
    palette: accentRgb
      ? [
          primary,
          secondary,
          accentStrong,
          `rgba(${accentRgb}, 0.85)`,
          `rgba(${accentRgb}, 0.65)`,
          `rgba(${accentRgb}, 0.45)`,
          `rgba(${accentRgb}, 0.3)`,
          `rgba(${accentRgb}, 0.2)`,
        ]
      : [primary, secondary, accentStrong],
  };
}

/** Reads accent/muted from CSS vars — updates when theme changes. */
export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(() => readChartColors());

  useEffect(() => {
    setColors(readChartColors());
  }, [resolvedTheme]);

  return colors;
}

/** Heatmap cell fill — gold intensity scales with logged hours. */
export function heatmapCellColor(hours: number, dark?: boolean): string {
  if (hours === 0) return "var(--line)";
  const base = dark ? 0.15 : 0.2;
  const alpha = Math.min(1, base + hours / 10);
  return `rgba(var(--accent-rgb), ${alpha})`;
}
