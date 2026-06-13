import { cn } from "@/lib/utils";

/** Cadence wordmark — Space Grotesk, tight tracking, gold cadence dot. */
export function Wordmark({
  className,
  showDot = true,
}: {
  className?: string;
  showDot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-display text-xl font-semibold tracking-tightest text-ink",
        className,
      )}
    >
      Cadence
      {showDot && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-accent"
        />
      )}
    </span>
  );
}
