import { Timer } from "lucide-react";

import { cn } from "@/lib/utils";

/** Subtle inline marker for entries saved via the floating timer. */
export function TimerProvenanceMarker({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]",
        compact
          ? "p-0.5"
          : "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
      title="Logged via timer"
    >
      <Timer className={compact ? "h-3 w-3" : "h-3 w-3"} aria-hidden />
      {!compact ? "Timer" : null}
      <span className="sr-only">Logged via timer</span>
    </span>
  );
}
