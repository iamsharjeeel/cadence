import { cn } from "@/lib/utils";

type CardDensity = "compact" | "comfortable";

const CARD_DENSITY_CLASSES: Record<CardDensity, string> = {
  compact:
    "[--card-pad-x:1rem] [--card-pad-y:0.875rem] [--card-footer-y:0.75rem] [--card-title-size:1rem]",
  comfortable:
    "[--card-pad-x:1.5rem] [--card-pad-y:1.25rem] [--card-footer-y:1rem] [--card-title-size:1.125rem]",
};

export function Card({
  density = "compact",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { density?: CardDensity }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--line)] bg-surface shadow-card transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-float",
        CARD_DENSITY_CLASSES[density],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 border-b border-[var(--line)] px-[var(--card-pad-x)] py-[var(--card-pad-y)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-[length:var(--card-title-size)] font-semibold leading-snug tracking-tightest",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] text-muted", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-[var(--card-pad-x)] py-[var(--card-pad-y)]", className)}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-[var(--line)] px-[var(--card-pad-x)] py-[var(--card-footer-y)]",
        className,
      )}
      {...props}
    />
  );
}
