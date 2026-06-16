"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MotionCard } from "@/components/motion/MotionCard";
import { MotionTR } from "@/components/motion/MotionTR";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { useToast } from "@/components/ui/Toast";
import { cn, formatDate } from "@/lib/utils";
import {
  formatLeaveAmount,
  type LeaveUnit,
} from "@/lib/leave/types";
import type { LeaveType } from "@/types/db";
import type { RequestWithMeta } from "@/lib/leave/queries";
import {
  cancelLeaveRequest,
  deletePersonalLeave,
} from "./actions";
import { RequestLeaveModal } from "./RequestLeaveModal";

function statusTone(status: string) {
  if (status === "approved") return "text-[var(--accent-strong)]";
  if (status === "rejected") return "text-[var(--danger)]";
  if (status === "pending") return "text-muted";
  return "text-muted";
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

function entryLabel(hit: RequestWithMeta) {
  return (hit.leave_type?.name ?? hit.note?.trim()) || "Time off";
}

export function LeaveEmployeeView({
  mode,
  requests,
  leaveTypes = [],
  calendarMonth,
}: {
  mode: "personal" | "org";
  requests: RequestWithMeta[];
  leaveTypes?: LeaveType[];
  calendarMonth: string;
}) {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const { toast } = useToast();

  const calendarRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status !== "cancelled" &&
          (mode === "personal"
            ? r.status === "approved"
            : r.status === "approved" || r.status === "pending"),
      ),
    [requests, mode],
  );

  const days = daysInMonth(calendarMonth);
  const offset = weekdayOffset(calendarMonth);
  const monthLabel = new Date(`${calendarMonth}-01`).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  async function cancel(id: string) {
    setActingId(id);
    try {
      const result = await cancelLeaveRequest(id);
      toast(result.message, result.ok ? "success" : "error");
    } finally {
      setActingId(null);
    }
  }

  async function removePersonal(id: string) {
    setActingId(id);
    try {
      const result = await deletePersonalLeave(id);
      toast(result.message, result.ok ? "success" : "error");
    } finally {
      setActingId(null);
    }
  }

  const ctaLabel = mode === "personal" ? "Mark time off" : "Request leave";
  const description =
    mode === "personal"
      ? "Mark days off on your personal calendar."
      : "Request time off for manager approval.";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{description}</p>
        <Button onClick={() => setRequestModalOpen(true)}>{ctaLabel}</Button>
      </div>

      <MotionCard className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Calendar — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent className="bg-surface p-0">
          <div className="grid grid-cols-7 gap-px bg-[var(--line)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="bg-surface py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[72px] bg-surface" />
            ))}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const iso = dateStr(calendarMonth, day);
              const hit = requestOnDay(calendarRequests, iso);
              return (
                <div
                  key={day}
                  className={cn(
                    "relative min-h-[72px] bg-surface p-2 transition-colors",
                    !hit && "hover:bg-container",
                    hit?.status === "approved" &&
                      "bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)]",
                    hit?.status === "pending" &&
                      "bg-container ring-1 ring-inset ring-dashed ring-[var(--line)]",
                    hit &&
                      hit.status !== "approved" &&
                      hit.status !== "pending" &&
                      "bg-surface-low ring-1 ring-inset ring-[var(--line)]",
                  )}
                  title={hit ? `${entryLabel(hit)} (${hit.status})` : undefined}
                >
                  <span className="text-[13px] text-muted">{day}</span>
                  {hit ? (
                    <p className="mt-1 truncate text-[10px] font-medium text-ink dark:text-[var(--accent)]">
                      {entryLabel(hit)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="px-4 py-3 text-xs text-muted">
            {mode === "personal"
              ? "Gold highlights show your marked time off."
              : "Solid highlights are approved leave; dashed borders are pending requests."}
          </p>
        </CardContent>
      </MotionCard>

      <MotionCard className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "personal" ? "Your time off" : "Request history"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">
              {mode === "personal" ? "No time off marked yet." : "No requests yet."}
            </p>
          ) : (
            <Table className="[&_tbody_tr:nth-child(even)]:bg-surface-low/50">
              <THead className="bg-surface-low">
                <TR>
                  {mode === "org" ? <TH>Category</TH> : null}
                  <TH>Dates</TH>
                  <TH>Amount</TH>
                  {mode === "org" ? <TH>Status</TH> : null}
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {requests.map((r, i) => {
                  const unit: LeaveUnit =
                    r.leave_type?.unit === "hours" ? "hours" : "days";
                  return (
                    <MotionTR key={r.id} index={i}>
                      {mode === "org" ? (
                        <TD className="text-sm">
                          {r.leave_type?.name ?? "—"}
                        </TD>
                      ) : null}
                      <TD className="tabular text-sm text-muted">
                        {formatDate(r.start_date)}
                        {r.start_date !== r.end_date
                          ? ` – ${formatDate(r.end_date)}`
                          : ""}
                      </TD>
                      <TD className="tabular text-sm">
                        {formatLeaveAmount(Number(r.days_requested), unit)}
                      </TD>
                      {mode === "org" ? (
                        <TD
                          className={`text-sm capitalize ${statusTone(r.status)}`}
                        >
                          {r.status}
                        </TD>
                      ) : null}
                      <TD className="text-right">
                        {mode === "org" && r.status === "pending" ? (
                          <RowActionsMenu
                            actions={[
                              {
                                label:
                                  actingId === r.id
                                    ? "Cancelling…"
                                    : "Cancel request",
                                onClick: () => cancel(r.id),
                              },
                            ]}
                          />
                        ) : null}
                        {mode === "personal" && r.status === "approved" ? (
                          <RowActionsMenu
                            actions={[
                              {
                                label:
                                  actingId === r.id ? "Removing…" : "Remove",
                                onClick: () => removePersonal(r.id),
                              },
                            ]}
                          />
                        ) : null}
                      </TD>
                    </MotionTR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </MotionCard>

      {requestModalOpen ? (
        <RequestLeaveModal
          mode={mode}
          leaveTypes={leaveTypes}
          onClose={() => setRequestModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
