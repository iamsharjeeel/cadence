import { cn } from "@/lib/utils";

/**
 * Official Google Calendar color mark — multicolor SVG.
 */
export function GoogleCalendarIcon({
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
      <rect x="3" y="4" width="18" height="17" rx="2" fill="#4285F4" />
      <rect x="3" y="4" width="18" height="5" fill="#34A853" />
      <rect x="3" y="9" width="5" height="12" fill="#FBBC05" />
      <rect x="16" y="9" width="5" height="12" fill="#EA4335" />
      <rect x="8" y="11" width="8" height="8" rx="1" fill="#FFFFFF" />
    </svg>
  );
}
