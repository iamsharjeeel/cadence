"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  VIEW_PERIOD_OPTIONS,
  type ViewPeriodCadence,
} from "@/lib/time/periods";

export function TimeTrackingPeriodNavigation({
  viewCadence,
  isCurrentPeriod,
  onCadenceChange,
  onPrevious,
  onCurrent,
  onNext,
}: {
  viewCadence: ViewPeriodCadence;
  isCurrentPeriod: boolean;
  onCadenceChange: (cadence: ViewPeriodCadence) => void;
  onPrevious: () => void;
  onCurrent: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div
        className="inline-flex rounded-full border border-[var(--line)] p-0.5"
        role="group"
        aria-label="Period view"
      >
        {VIEW_PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onCadenceChange(opt.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              viewCadence === opt.value
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-muted hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-card)] bg-surface p-1.5 shadow-card">
        <Button type="button" variant="ghost" size="sm" onClick={onPrevious}>
          ← Prev
        </Button>
        <Button
          type="button"
          variant={isCurrentPeriod ? "secondary" : "ghost"}
          size="sm"
          onClick={onCurrent}
        >
          This period
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}
