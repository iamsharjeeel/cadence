import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/utils";
import type {
  DocumentStatus,
  DocumentType,
  TimesheetStatus,
  UserRole,
  UserStatus,
} from "@/types/db";

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

// draft (grey), submitted (blue), approved (teal), rejected (red), live (teal pulse for draft)
export function TimesheetStatusPill({
  status,
  live,
}: {
  status: TimesheetStatus;
  live?: boolean;
}) {
  if (status === "approved") return <Badge tone="accent">Approved</Badge>;
  if (status === "rejected") return <Badge tone="danger">Rejected</Badge>;
  if (status === "submitted")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(37,99,235,0.12)] px-2.5 py-1 text-xs font-medium text-[#2563EB] dark:text-[#7AA2F7]">
        Submitted
      </span>
    );
  if (status === "draft") {
    if (live) return <Badge tone="accent">Live</Badge>;
    return <Badge tone="muted">In progress</Badge>;
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

export function DocumentStatusPill({ status }: { status: DocumentStatus }) {
  if (status === "verified")
    return <Badge tone="accent">Verified</Badge>;
  if (status === "in_progress")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(37,99,235,0.12)] px-2.5 py-1 text-xs font-medium text-[#2563EB] dark:text-[#7AA2F7]">
        In progress
      </span>
    );
  if (status === "corrections_needed")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(245,158,11,0.15)] px-2.5 py-1 text-xs font-medium text-[#B45309] dark:text-[#FBBF24]">
        Corrections needed
      </span>
    );
  return <Badge tone="muted">Draft</Badge>;
}
