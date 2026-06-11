import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-[color,background-color,border-color,box-shadow,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-card hover:bg-[var(--accent-strong)]",
  secondary:
    "border bg-surface text-ink hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]",
  ghost:
    "border bg-transparent text-ink hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]",
  danger:
    "bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
};

/** Shared button surface classes for `<Link>` CTAs (avoids nested button in anchor). */
export function buttonStyles(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

export type { Variant as ButtonVariant, Size as ButtonSize };
