import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-8 w-8 text-xs rounded-lg",
  md: "h-10 w-10 text-sm rounded-lg",
  lg: "h-12 w-12 text-base rounded-xl",
} as const;

export function OrgLogo({
  name,
  logoUrl,
  size = "sm",
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        className={cn(
          "shrink-0 border border-[var(--line)] bg-[var(--line)] object-cover",
          SIZES[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-[var(--accent)] font-semibold text-white",
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {letter}
    </div>
  );
}
