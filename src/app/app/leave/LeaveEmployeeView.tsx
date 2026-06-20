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
import type { GoogleCalendarEventWithMeta } from "@/lib/google-calendar/sync";
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

function requestsOnDay(requests: RequestWithMeta[], iso: string) {
  return requests.filter(
    (r) =>
      r.status !== "cancelled" &&
      r.start_date <= iso &&
      r.end_date >= iso,
  );
}

function calendarEventsOnDay(
  events: GoogleCalendarEventWithMeta[],
  iso: string,
) {
  const dayStart = new Date(`${iso}T00:00:00`).getTime();
  const dayEnd = new Date(`${iso}T23:59:59.999`).getTime();
  return events.filter((e) => {
    const start = new Date(e.start_at).getTime();
    const end = new Date(e.end_at).getTime();
    return start <= dayEnd && end >= dayStart;
  });
}

function GCalDayChip({ title }: { title: string }) {
  return (
    <span
      className="block w-full truncate rounded-[var(--radius-chip)] border border-[#4285F4]/30 bg-[#E8F0FE] px-1.5 py-0.5 text-[10px] font-medium leading-snug text-[#1A73E8] dark:border-[#8AB4F8]/30 dark:bg-[#1A2B45] dark:text-[#8AB4F8]"
      title={title}
    >
      {title}
    </span>
  );
}

function LeaveDayPill({ hit }: { hit: RequestWithMeta }) {
  const label = entryLabel(hit);
  const pending = hit.status === "pending";
  return (
    <span
      className={cn(
        "block w-full truncate rounded-[var(--radius-chip)] px-1.5 py-0.5 text-[10px] font-semibold leading-snug",
        pending
          ? "border border-dashed border-[var(--accent)]/40 bg-surface text-muted"
          : "bg-[var(--accent)] text-white shadow-sm dark:bg-[var(--accent-mid)] dark:text-ink",
      )}
      title={`${label} (${hit.status})`}
    >
      {label}
    </span>
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
  calendarEvents = [],
}: {
  mode: "personal" | "org";
  requests: RequestWithMeta[];
  leaveTypes?: LeaveType[];
  calendarMonth: string;
  calendarEvents?: GoogleCalendarEventWithMeta[];
}) {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestSeedDate, setRequestSeedDate] = useState<string | undefined>();
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
        <Button
          onClick={() => {
            setRequestSeedDate(undefined);
            setRequestModalOpen(true);
          }}
        >
          {ctaLabel}
        </Button>
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
              const hits = requestsOnDay(calendarRequests, iso);
              const gcalHits = calendarEventsOnDay(calendarEvents, iso);
              const hasApproved = hits.some((h) => h.status === "approved");
              const hasPending = hits.some((h) => h.status === "pending");
              const visible = hits.slice(0, 2);
              const gcalSlots = Math.max(0, 2 - visible.length);
              const visibleGcal = gcalHits.slice(0, gcalSlots);
              const totalItems = hits.length + gcalHits.length;
              const shownCount = visible.length + visibleGcal.length;
              const moreCount = totalItems - shownCount;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setRequestSeedDate(iso);
                    setRequestModalOpen(true);
                  }}
                  className={cn(
                    "relative flex min-h-[80px] flex-col gap-1 bg-surface p-1.5 text-left transition-colors",
                    "cursor-pointer hover:bg-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
                    totalItems === 0 && "hover:bg-container",
                    hasApproved &&
                      "bg-[var(--accent-soft)]/50 ring-1 ring-inset ring-[var(--accent)]/25",
                    hasPending &&
                      !hasApproved &&
                      "bg-container/80 ring-1 ring-inset ring-dashed ring-[var(--line)]",
                  )}
                >
                  <span
                    className={cn(
                      "text-[12px] font-medium tabular leading-none",
                      hits.length > 0
                        ? "text-[var(--accent-strong)]"
                        : "text-muted",
                    )}
                  >
                    {day}
                  </span>
                  {hits.length > 0 || gcalHits.length > 0 ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                      {visible.map((hit) => (
                        <LeaveDayPill key={hit.id} hit={hit} />
                      ))}
                      {visibleGcal.map((event) => (
                        <GCalDayChip
                          key={event.id}
                          title={event.title?.trim() || "Calendar event"}
                        />
                      ))}
                      {(moreCount > 0) ? (
                        <span className="truncate px-0.5 text-[10px] font-medium text-muted">
                          +{moreCount} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="px-4 py-3 text-xs text-muted">
            {mode === "personal"
              ? "Gold pills show your marked time off. Blue pills are synced Google Calendar events. Click a day to mark time off."
              : "Solid gold pills are approved leave; dashed pills are pending. Blue pills are Google Calendar events. Click a day to request leave."}
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
          initialStartDate={requestSeedDate}
          onClose={() => {
            setRequestModalOpen(false);
            setRequestSeedDate(undefined);
          }}
        />
      ) : null}
    </div>
  );
}
