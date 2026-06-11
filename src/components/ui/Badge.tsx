import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/utils";
import type { UserRole, UserStatus } from "@/types/db";

type Tone = "accent" | "muted" | "danger";

export function Badge({
  children,
  tone = "accent",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "accent" &&
          "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
        tone === "muted" && "bg-[var(--line)] text-muted",
        tone === "danger" && "bg-[var(--danger-soft)] text-[var(--danger)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<UserStatus, Tone> = {
  active: "accent",
  pending: "muted",
  suspended: "danger",
};

export function StatusPill({ status }: { status: UserStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{titleCase(status)}</Badge>;
}

export function RolePill({ role }: { role: UserRole }) {
  return <Badge tone="muted">{titleCase(role)}</Badge>;
}
