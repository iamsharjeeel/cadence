"use client";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("animate-pulse rounded bg-[var(--line)]", className)}
      aria-hidden
    />
  );
}

/** Pulsing skeleton rows for timesheet tables. */
export function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b last:border-0">
          {Array.from({ length: 5 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 max-w-[8rem] animate-pulse rounded bg-[var(--line)]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Card skeleton with pulsing grey bars. */
export function CardSkeleton({ bars = 3 }: { bars?: number }) {
  return (
    <div className="rounded-[var(--radius)] border bg-surface p-6 shadow-card">
      <div className="mb-4 h-3 w-24 animate-pulse rounded bg-[var(--line)]" />
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="mb-3 h-4 w-full animate-pulse rounded bg-[var(--line)]"
        />
      ))}
    </div>
  );
}
