import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/utils";
import type { TimesheetStatus, UserRole, UserStatus } from "@/types/db";

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

// draft (grey), submitted (blue), approved (teal), rejected (red)
export function TimesheetStatusPill({ status }: { status: TimesheetStatus }) {
  if (status === "approved") return <Badge tone="accent">Approved</Badge>;
  if (status === "rejected") return <Badge tone="danger">Rejected</Badge>;
  if (status === "submitted")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(37,99,235,0.12)] px-2.5 py-1 text-xs font-medium text-[#2563EB] dark:text-[#7AA2F7]">
        Submitted
      </span>
    );
  return <Badge tone="muted">Draft</Badge>;
}
