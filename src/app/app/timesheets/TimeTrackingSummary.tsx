"use client";

import type { ReactNode } from "react";

import { LogSummarySkeleton } from "./LogWeekSkeleton";

export function TimeTrackingSummary({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <aside className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-5 shadow-card lg:sticky lg:top-6 lg:self-start">
      {loading ? <LogSummarySkeleton /> : children}
    </aside>
  );
}
