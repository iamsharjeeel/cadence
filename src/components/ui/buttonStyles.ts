import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent-mid)] text-white hover:bg-[var(--accent-strong)] dark:bg-[var(--accent)] dark:text-[var(--background)] dark:hover:bg-[var(--accent-strong)]",
  secondary:
    "border border-[var(--line)] bg-transparent text-ink hover:bg-[var(--accent-soft)] dark:border-[var(--line)] dark:bg-transparent dark:text-[var(--ink)] dark:hover:border-[var(--accent)] dark:hover:text-[var(--accent)] dark:hover:bg-transparent",
  ghost:
    "bg-transparent text-ink hover:bg-[var(--accent-soft)]",
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
