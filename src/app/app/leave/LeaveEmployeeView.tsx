"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MotionCard } from "@/components/motion/MotionCard";
import { MotionTR } from "@/components/motion/MotionTR";
import { CountUp } from "@/components/motion/CountUp";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn, formatDate } from "@/lib/utils";
import type { LeaveType } from "@/types/db";
import type { BalanceWithType, RequestWithMeta } from "@/lib/leave/queries";
import { cancelLeaveRequest } from "./actions";
import { RequestLeaveModal } from "./RequestLeaveModal";

function statusTone(status: string) {
  if (status === "approved") return "text-[var(--accent-strong)]";
  if (status === "rejected") return "text-[var(--danger)]";
  if (status === "pending") return "text-muted";
  return "text-muted";
}

function buildDisplayBalances(
  leaveTypes: LeaveType[],
  balances: BalanceWithType[],
): BalanceWithType[] {
  const byType = new Map(balances.map((b) => [b.leave_type_id, b]));
  return leaveTypes
    .filter((t) => t.is_active)
    .map((lt) => {
      const existing = byType.get(lt.id);
      if (existing) return existing;
      return {
        id: lt.id,
        org_id: lt.org_id,
        employee_id: "",
        leave_type_id: lt.id,
        year: new Date().getFullYear(),
        allocated_days: lt.default_days_per_year ?? 0,
        used_days: 0,
        pending_days: 0,
        created_at: lt.created_at,
        leave_type: {
          name: lt.name,
          category: lt.category,
          color: lt.color ?? "var(--accent-mid)",
        },
      } as BalanceWithType;
    });
}

function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function weekdayOffset(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).getDay();
}

function dateStr(ym: string, day: number) {
  const [y, m] = ym.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function requestOnDay(requests: RequestWithMeta[], iso: string) {
  return requests.find(
    (r) =>
      r.status !== "cancelled" &&
      r.start_date <= iso &&
      r.end_date >= iso,
  );
}

export function LeaveEmployeeView({
  balances,
  requests,
  leaveTypes,
  calendarMonth,
}: {
  balances: BalanceWithType[];
  requests: RequestWithMeta[];
  leaveTypes: LeaveType[];
  calendarMonth: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();

  const displayBalances = useMemo(
    () => buildDisplayBalances(leaveTypes, balances),
    [leaveTypes, balances],
  );

  const calendarRequests = useMemo(
    () => requests.filter((r) => r.status !== "cancelled"),
    [requests],
  );

  const days = daysInMonth(calendarMonth);
  const offset = weekdayOffset(calendarMonth);
  const monthLabel = new Date(`${calendarMonth}-01`).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  async function cancel(id: string) {
    setCancellingId(id);
    try {
      const result = await cancelLeaveRequest(id);
      toast(result.message, result.ok ? "success" : "error");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Request time off and track your remaining balance.
        </p>
        <Button onClick={() => setModalOpen(true)} disabled={leaveTypes.length === 0}>
          Request leave
        </Button>
      </div>

      {displayBalances.length === 0 ? (
        <EmptyState
          title="No leave types configured"
          description="Your organization hasn't set up leave types yet. Contact your admin."
        />
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {displayBalances.map((b) => {
            const remaining =
              Number(b.allocated_days) -
              Number(b.used_days) -
              Number(b.pending_days);
            const allocated = Number(b.allocated_days);
            const usedPct =
              allocated > 0
                ? Math.min(100, ((allocated - remaining) / allocated) * 100)
                : 0;
            const unit = b.leave_type.category === "hours" ? "hrs" : "days";
            return (
              <MotionCard
                key={b.leave_type_id}
                className="shadow-card dark:border dark:border-[var(--line)] dark:bg-[var(--surface)] dark:shadow-none"
              >
                <CardContent className="p-5">
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {b.leave_type.name}
                  </p>
                  <p className="mt-3 font-display text-[48px] font-bold leading-none tabular text-ink dark:text-[var(--accent)]">
                    <CountUp value={remaining} decimals={1} />
                    <span className="ml-1.5 font-body text-[16px] font-normal text-muted">
                      {unit}
                    </span>
                  </p>
                  <div className="mt-4 h-[3px] w-full overflow-hidden rounded-[var(--radius-chip)] bg-surface-low">
                    <div
                      className="h-full rounded-[var(--radius-chip)] bg-accent-mid"
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </CardContent>
              </MotionCard>
            );
          })}
        </div>
      )}

      <MotionCard className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Calendar — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent className="bg-surface">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const iso = dateStr(calendarMonth, day);
              const hit = requestOnDay(calendarRequests, iso);
              return (
                <div
                  key={day}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-[var(--radius-input)] text-sm transition-colors",
                    !hit && "bg-surface-low text-muted hover:bg-container",
                    hit?.status === "approved" &&
                      "border border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-ink",
                    hit?.status === "pending" &&
                      "border border-dashed border-[var(--line)] bg-container font-medium text-ink",
                    hit &&
                      hit.status !== "approved" &&
                      hit.status !== "pending" &&
                      "border border-[var(--line)] bg-surface-low font-medium text-ink",
                  )}
                  title={
                    hit
                      ? `${hit.leave_type.name} (${hit.status})`
                      : undefined
                  }
                >
                  {day}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted">
            Highlighted days show approved or pending leave.
          </p>
        </CardContent>
      </MotionCard>

      <MotionCard className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Request history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">No requests yet.</p>
          ) : (
            <Table className="[&_tbody_tr:nth-child(even)]:bg-surface-low/50">
              <THead className="bg-surface-low">
                <TR>
                  <TH>Type</TH>
                  <TH>Dates</TH>
                  <TH>Days</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {requests.map((r, i) => (
                  <MotionTR key={r.id} index={i}>
                    <TD className="text-sm">{r.leave_type.name}</TD>
                    <TD className="tabular text-sm text-muted">
                      {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    </TD>
                    <TD className="tabular text-sm">{r.days_requested}</TD>
                    <TD className={`text-sm capitalize ${statusTone(r.status)}`}>
                      {r.status}
                    </TD>
                    <TD className="text-right">
                      {r.status === "pending" && (
                        <RowActionsMenu
                          actions={[
                            {
                              label:
                                cancellingId === r.id
                                  ? "Cancelling…"
                                  : "Cancel request",
                              onClick: () => cancel(r.id),
                            },
                          ]}
                        />
                      )}
                    </TD>
                  </MotionTR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </MotionCard>

      {modalOpen && (
        <RequestLeaveModal
          leaveTypes={leaveTypes.filter((t) => t.is_active)}
          balances={displayBalances}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
