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
    <MotionCard>
      <CardContent className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
        {children ?? (
          <CountUp
            value={value ?? 0}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
            className="text-2xl font-semibold text-ink"
          />
        )}
      </CardContent>
    </MotionCard>
  );
}
