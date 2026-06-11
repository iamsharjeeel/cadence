/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  email,
  src,
  size = 36,
  className,
}: {
  name: string | null;
  email: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] font-display text-xs font-semibold",
        className,
      )}
      style={dimension}
    >
      {src ? (
        // Avatar URLs come from Google; plain <img> avoids next/image config churn.
        <img
          src={src}
          alt={name ?? email}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{initials(name, email)}</span>
      )}
    </span>
  );
}
