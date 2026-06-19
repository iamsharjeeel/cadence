import { cn } from "@/lib/utils";
import { roleLabel, titleCase } from "@/lib/utils";
import type {
  DocumentStatus,
  DocumentType,
  TimesheetStatus,
  UserRole,
  UserStatus,
} from "@/types/db";

type Tone = "accent" | "muted" | "danger" | "success" | "pending" | "error";

const badgeBase =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] px-2.5 py-1 text-xs font-medium font-body dark:rounded-none";

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
        badgeBase,
        tone === "accent" &&
          "bg-[var(--accent-soft)] text-[var(--accent)] dark:border dark:border-[var(--line)] dark:bg-transparent dark:text-[var(--ink-muted)]",
        tone === "muted" &&
          "bg-surface-low text-muted dark:border dark:border-[var(--line)] dark:bg-transparent dark:text-[var(--ink-muted)]",
        tone === "danger" &&
          "bg-[var(--danger-soft)] text-[var(--danger)] dark:border dark:border-[#8B2020] dark:bg-transparent dark:text-[#E07070]",
        tone === "success" &&
          "bg-[#E8F4EA] text-[#2D6A35] dark:border dark:border-[#3A6B2A] dark:bg-transparent dark:text-[#7DBF6A]",
        tone === "pending" &&
          "bg-[var(--accent-soft)] text-[var(--accent)] dark:border dark:border-[var(--accent)] dark:bg-transparent dark:text-[var(--accent)]",
        tone === "error" &&
          "bg-[#FBE9E9] text-[#8B2020] dark:border dark:border-[#8B2020] dark:bg-transparent dark:text-[#E07070]",
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<UserStatus, Tone> = {
  active: "success",
  pending: "pending",
  suspended: "error",
};

export function StatusPill({ status }: { status: UserStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{titleCase(status)}</Badge>;
}

export function RolePill({ role }: { role: UserRole }) {
  return (
    <Badge tone="pending" className="text-[12px]">
      {roleLabel(role)}
    </Badge>
  );
}

export function TimesheetStatusPill({
  status,
  live,
}: {
  status: TimesheetStatus;
  live?: boolean;
}) {
  if (status === "approved") return <Badge tone="success">Approved</Badge>;
  if (status === "rejected") return <Badge tone="error">Rejected</Badge>;
  if (status === "submitted") return <Badge tone="pending">Submitted</Badge>;
  if (status === "draft") {
    if (live) return <Badge tone="pending">Live</Badge>;
    return <Badge tone="muted">Draft</Badge>;
  }
  return <Badge tone="muted">Draft</Badge>;
}

export function DocumentTypePill({ type }: { type: DocumentType }) {
  return (
    <Badge tone="muted">
      {type === "pay_advice" ? "Pay Advice" : "Invoice"}
    </Badge>
  );
}

export function OvertimeBadge({ hours }: { hours: number }) {
  return (
    <Badge tone="pending">
      Overtime{" "}
      <span className="tabular">+{hours.toFixed(1)}h</span>
    </Badge>
  );
}

export function DocumentStatusPill({ status }: { status: DocumentStatus }) {
  if (status === "verified") return <Badge tone="success">Verified</Badge>;
  if (status === "in_progress") return <Badge tone="pending">In progress</Badge>;
  if (status === "corrections_needed")
    return <Badge tone="error">Corrections needed</Badge>;
  return <Badge tone="muted">Draft</Badge>;
}
