import { cn } from "@/lib/utils";

/**
 * Official Asana logo mark (three pebbles). Source: Asana brand assets —
 * three coral circles in the standard triangular arrangement.
 */
export function AsanaIcon({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="12" cy="7" r="4.25" fill="#F06A6A" />
      <circle cx="5.5" cy="16.5" r="4.25" fill="#F06A6A" />
      <circle cx="18.5" cy="16.5" r="4.25" fill="#F06A6A" />
    </svg>
  );
}
