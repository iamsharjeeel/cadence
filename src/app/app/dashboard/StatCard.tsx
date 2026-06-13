"use client";

import { CountUp } from "@/components/motion/CountUp";
import { CardContent } from "@/components/ui/Card";
import { MotionCard } from "@/components/motion/MotionCard";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  delta,
  children,
}: {
  label: string;
  value?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delta?: { value: string; positive?: boolean };
  children?: React.ReactNode;
}) {
  return (
    <MotionCard className="dark:border dark:border-[var(--line)] dark:bg-[var(--surface)] dark:shadow-none">
      <CardContent className="flex flex-col gap-0 py-6">
        <span className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-muted dark:text-[var(--ink-muted)]">
          {label}
        </span>
        <div className="py-4">
          {children ?? (
            <CountUp
              value={value ?? 0}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
              className="font-display text-[42px] font-bold leading-none tabular text-ink dark:text-[var(--accent)]"
            />
          )}
        </div>
        {delta && (
          <p className="text-[13px] text-muted">
            <span
              className={cn(
                "font-medium",
                delta.positive === true && "text-[#2D6A35]",
                delta.positive === false && "text-[#8B2020]",
              )}
            >
              {delta.positive === true ? "↑ " : delta.positive === false ? "↓ " : ""}
              {delta.value}
            </span>
            {" vs last period"}
          </p>
        )}
      </CardContent>
    </MotionCard>
  );
}
