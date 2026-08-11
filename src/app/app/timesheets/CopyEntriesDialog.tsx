"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type CopyTargetDay = {
  date: string;
  dayName: string;
  isWeekend: boolean;
};

export function CopyEntriesDialog({
  open,
  sourceDate,
  days,
  selectedDates,
  onToggle,
  onCancel,
  onConfirm,
  formatDayLabel,
}: {
  open: boolean;
  sourceDate: string | null;
  days: CopyTargetDay[];
  selectedDates: Set<string>;
  onToggle: (date: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  formatDayLabel: (date: string, dayName: string) => string;
}) {
  if (!open || !sourceDate) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col rounded-[var(--radius-card)] bg-surface p-6 shadow-float">
        <h3 className="font-display text-base font-semibold text-ink">Copy entry to days</h3>
        <p className="mt-1 text-sm text-muted">
          Select which days in this period should receive a copy of this entry.
        </p>
        <div className="mt-4 max-h-64 overflow-y-auto rounded-[var(--radius-input)] border border-[var(--line)]">
          {days.filter((day) => day.date !== sourceDate).map((day) => {
            const checked = selectedDates.has(day.date);
            return (
              <label
                key={day.date}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b border-[var(--line)] px-3 py-2.5 last:border-0",
                  "hover:bg-[var(--surface-low)]",
                  day.isWeekend && "bg-[var(--surface-low)]/50",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(day.date)}
                  className="h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)]"
                />
                <span className="text-sm text-ink">{formatDayLabel(day.date, day.dayName)}</span>
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm" disabled={selectedDates.size === 0} onClick={onConfirm}>
            Copy to selected
          </Button>
        </div>
      </div>
    </div>
  );
}
