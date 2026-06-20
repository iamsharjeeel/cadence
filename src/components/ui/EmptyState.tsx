import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-semibold tracking-tightest">
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
