"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { countBusinessDays } from "@/lib/leave/days";
import {
  formatLeaveAmount,
  type LeaveUnit,
} from "@/lib/leave/types";
import type { LeaveType } from "@/types/db";
import { markPersonalLeave, requestLeave } from "./actions";

export function RequestLeaveModal({
  mode,
  leaveTypes = [],
  initialStartDate,
  onClose,
}: {
  mode: "personal" | "org";
  leaveTypes?: LeaveType[];
  initialStartDate?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const activeTypes = leaveTypes.filter((t) => t.is_active);
  const hasTypes = activeTypes.length > 0;

  const [leaveTypeId, setLeaveTypeId] = useState(activeTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState(initialStartDate ?? "");
  const [halfDay, setHalfDay] = useState(false);
  const [hoursRequested, setHoursRequested] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedType = activeTypes.find((t) => t.id === leaveTypeId);
  const unit: LeaveUnit =
    mode === "org" && selectedType?.unit === "hours" ? "hours" : "days";

  useEffect(() => {
    setHalfDay(false);
    setHoursRequested("");
    setEndDate("");
  }, [leaveTypeId, mode]);

  const days = useMemo(() => {
    if (unit === "hours") return 0;
    if (!startDate || !endDate) return 0;
    return countBusinessDays(startDate, endDate, halfDay);
  }, [startDate, endDate, halfDay, unit]);

  const hours = useMemo(() => {
    if (unit !== "hours") return 0;
    const n = Number(hoursRequested);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [hoursRequested, unit]);

  const requestedAmount = unit === "hours" ? hours : days;

  const canSubmit =
    requestedAmount > 0 &&
    (unit === "hours"
      ? Boolean(startDate) && Boolean(leaveTypeId)
      : Boolean(startDate && endDate));

  async function submit() {
    setBusy(true);
    try {
      const result =
        mode === "personal"
          ? await markPersonalLeave({
              startDate,
              endDate,
              halfDay,
              note,
            })
          : await requestLeave({
              leaveTypeId: hasTypes && leaveTypeId ? leaveTypeId : null,
              startDate,
              endDate: unit === "hours" ? startDate : endDate,
              halfDay: unit === "hours" ? false : halfDay,
              hoursRequested: unit === "hours" ? hours : undefined,
              note,
            });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) onClose();
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "personal" ? "Mark time off" : "Request leave";
  const submitLabel = mode === "personal" ? "Mark off" : "Submit request";

  return (
    <MotionModal open onClose={onClose} panelClassName="max-w-md">
      <h2 className="font-display text-lg font-semibold tracking-tightest">
        {title}
      </h2>
      <div className="mt-5 flex flex-col gap-4">
        {mode === "org" && hasTypes ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Category <span className="font-normal text-muted">(optional)</span>
            </span>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="h-10 rounded-[var(--radius-card)] border bg-surface px-3"
            >
              <option value="">No category</option>
              {activeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {unit === "hours" ? (
          <>
            <DatePicker
              label="Date"
              value={startDate}
              onChange={setStartDate}
            />
            <Input
              label="Hours requested"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.5"
              value={hoursRequested}
              onChange={(e) => setHoursRequested(e.target.value)}
            />
          </>
        ) : (
          <>
            <DatePicker
              label="Start date"
              value={startDate}
              onChange={setStartDate}
            />
            <DatePicker
              label="End date"
              value={endDate}
              onChange={setEndDate}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={halfDay}
                onChange={(e) => setHalfDay(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Half day
            </label>
          </>
        )}

        <Input
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-sm">
          <p>
            {unit === "hours" ? "Hours requested" : "Days marked"}:{" "}
            <span className="tabular font-semibold">
              {requestedAmount > 0
                ? formatLeaveAmount(requestedAmount, unit)
                : "—"}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button onClick={submit} loading={busy} disabled={!canSubmit}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </MotionModal>
  );
}
