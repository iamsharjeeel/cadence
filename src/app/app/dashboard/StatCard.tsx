"use client";

import { CountUp } from "@/components/motion/CountUp";
import { CardContent } from "@/components/ui/Card";
import { MotionCard } from "@/components/motion/MotionCard";

export function StatCard({
  label,
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  children,
}: {
  label: string;
  value?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  children?: React.ReactNode;
}) {
  return (
    <MotionCard className="min-w-0 overflow-hidden [--card-pad-x:1.5rem] [--card-pad-y:1.25rem] [--card-footer-y:1rem] [--card-title-size:1.125rem] dark:border dark:border-[var(--line)] dark:bg-[var(--surface)] dark:shadow-none">
      <CardContent className="flex flex-col gap-0 py-6">
        <span className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-muted sm:text-[11px] dark:text-[var(--ink-muted)]">
          {label}
        </span>
        <div className="py-4">
          {children ?? (
            <CountUp
              value={value ?? 0}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
              className="truncate font-display text-3xl font-bold leading-none tabular text-ink sm:text-4xl lg:text-6xl dark:text-[var(--accent)]"
            />
          )}
        </div>
      </CardContent>
    </MotionCard>
  );
}
