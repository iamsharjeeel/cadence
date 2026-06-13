"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { GoogleEventDetailModal } from "@/components/google-calendar/GoogleEventDetailModal";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MotionCard } from "@/components/motion/MotionCard";
import { MotionTR } from "@/components/motion/MotionTR";
import { CountUp } from "@/components/motion/CountUp";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn, formatDate } from "@/lib/utils";
import {
  formatLeaveAmount,
  type LeaveUnit,
} from "@/lib/leave/types";
import type { LeaveType } from "@/types/db";
import type { BalanceWithType, RequestWithMeta } from "@/lib/leave/queries";
import type { GoogleCalendarEventWithMeta } from "@/lib/google-calendar/sync";
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
          unit: (lt.unit === "hours" ? "hours" : "days") as LeaveUnit,
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

function gcalEventsOnDay(events: GoogleCalendarEventWithMeta[], iso: string) {
  return events.filter((e) => e.start_at.slice(0, 10) === iso);
}

export function LeaveEmployeeView({
  balances,
  requests,
  leaveTypes,
  calendarMonth,
  googleCalendarEvents = [],
  showGoogleCalendar = false,
}: {
  balances: BalanceWithType[];
  requests: RequestWithMeta[];
  leaveTypes: LeaveType[];
  calendarMonth: string;
  googleCalendarEvents?: GoogleCalendarEventWithMeta[];
  showGoogleCalendar?: boolean;
}) {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [gcalModalOpen, setGcalModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedGcalEvent, setSelectedGcalEvent] =
    useState<GoogleCalendarEventWithMeta | null>(null);
  const [gcalEvents, setGcalEvents] = useState(googleCalendarEvents);
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
        <Button onClick={() => setRequestModalOpen(true)} disabled={leaveTypes.length === 0}>
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
            const unit: LeaveUnit =
              b.leave_type.unit === "hours" ? "hours" : "days";
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
                      {unit === "hours"
                        ? "h"
                        : remaining === 1
                          ? "day"
                          : "days"}
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

      <MotionCard className="mt-4 overflow-hidden">
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
              const dayGcal = showGoogleCalendar
                ? gcalEventsOnDay(gcalEvents, iso)
                : [];
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
                  title={
                    hit
                      ? `${hit.leave_type.name} (${hit.status})`
                      : undefined
                  }
                >
                  <span className="text-[13px] text-muted">{day}</span>
                  {dayGcal.length > 0 ? (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {dayGcal.slice(0, 2).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => {
                            setSelectedGcalEvent(event);
                            setGcalModalOpen(true);
                          }}
                          className="truncate rounded-full bg-[#4285F4] px-2 py-0.5 text-left text-[10px] font-medium text-white"
                        >
                          {event.title ?? "Event"}
                        </button>
                      ))}
                      {dayGcal.length > 2 ? (
                        <span className="text-[10px] text-muted">
                          +{dayGcal.length - 2} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="px-4 py-3 text-xs text-muted">
            Highlighted days show approved or pending leave.
            {showGoogleCalendar ? " Blue pills are synced Google Calendar events." : ""}
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
                  <TH>Amount</TH>
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
                    <TD className="tabular text-sm">
                      {formatLeaveAmount(
                        Number(r.days_requested),
                        r.leave_type.unit === "hours" ? "hours" : "days",
                      )}
                    </TD>
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

      {gcalModalOpen && selectedGcalEvent ? (
        <GoogleEventDetailModal
          open={gcalModalOpen}
          onClose={() => {
            setGcalModalOpen(false);
            setSelectedGcalEvent(null);
          }}
          event={selectedGcalEvent}
          onEventUpdated={(updated) => {
            setGcalEvents((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e)),
            );
            setSelectedGcalEvent(updated);
          }}
        />
      ) : null}

      {requestModalOpen && (
        <RequestLeaveModal
          leaveTypes={leaveTypes.filter((t) => t.is_active)}
          balances={displayBalances}
          onClose={() => setRequestModalOpen(false)}
        />
      )}
    </div>
  );
}
