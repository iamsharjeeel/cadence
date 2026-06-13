"use client";

import { CountUp } from "@/components/motion/CountUp";
import type { CurrencyTotals as Totals } from "@/lib/dashboard/queries";

export function CurrencyTotalsDisplay({ totals }: { totals: Totals }) {
  const entries = Object.entries(totals).filter(([, v]) => v > 0);

  if (entries.length === 0) {
    return (
      <span className="truncate font-display text-3xl font-bold leading-none tabular text-ink sm:text-4xl lg:text-6xl dark:text-[var(--accent)]">
        —
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {entries.map(([currency, amount]) => (
        <span
          key={currency}
          className="truncate font-display text-3xl font-bold leading-none tabular text-ink sm:text-4xl lg:text-6xl dark:text-[var(--accent)]"
        >
          <CountUp value={amount} decimals={2} prefix="" suffix="" />
          {" "}
          {currency}
        </span>
      ))}
    </div>
  );
}
