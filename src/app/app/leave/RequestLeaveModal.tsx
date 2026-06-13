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
import { requestLeave } from "./actions";

type BalanceRow = {
  leave_type_id: string;
  allocated_days: number;
  used_days: number;
  pending_days: number;
  leave_type?: { unit?: LeaveUnit };
};

export function RequestLeaveModal({
  leaveTypes,
  balances,
  onClose,
}: {
  leaveTypes: LeaveType[];
  balances: BalanceRow[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [hoursRequested, setHoursRequested] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const unit: LeaveUnit = selectedType?.unit === "hours" ? "hours" : "days";
  const bal = balances.find((b) => b.leave_type_id === leaveTypeId);

  useEffect(() => {
    setHalfDay(false);
    setHoursRequested("");
    setEndDate("");
  }, [leaveTypeId]);

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

  const remaining = bal
    ? Number(bal.allocated_days) -
      Number(bal.used_days) -
      Number(bal.pending_days)
    : 0;

  const canSubmit =
    requestedAmount > 0 &&
    (unit === "hours" ? Boolean(startDate) : Boolean(startDate && endDate)) &&
    (selectedType?.category === "unpaid" ||
      selectedType?.category === "sick" ||
      remaining >= requestedAmount);

  async function submit() {
    setBusy(true);
    try {
      const result = await requestLeave({
        leaveTypeId,
        startDate,
        endDate: unit === "hours" ? startDate : endDate,
        halfDay: unit === "hours" ? false : halfDay,
        hoursRequested: unit === "hours" ? hours : undefined,
        note,
      });
      if (
        !result.ok &&
        result.message.startsWith("Insufficient balance.")
      ) {
        toast(result.message, "error");
      } else {
        toast(result.message, result.ok ? "success" : "error");
      }
      if (result.ok) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <MotionModal open onClose={onClose} panelClassName="max-w-md">
      <h2 className="font-display text-lg font-semibold tracking-tightest">
        Request leave
      </h2>
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Leave type</span>
          <select
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className="h-10 rounded-[var(--radius-card)] border bg-surface px-3"
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

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
            {unit === "hours" ? "Hours requested" : "Days requested"}:{" "}
            <span className="tabular font-semibold">
              {requestedAmount > 0
                ? formatLeaveAmount(requestedAmount, unit)
                : "—"}
            </span>
          </p>
          {selectedType?.category !== "unpaid" && (
            <p className="mt-1 text-muted">
              Remaining balance:{" "}
              <span className="tabular font-medium">
                {formatLeaveAmount(remaining, unit)}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button onClick={submit} loading={busy} disabled={!canSubmit}>
          Submit request
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </MotionModal>
  );
}
