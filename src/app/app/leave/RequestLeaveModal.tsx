"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { countBusinessDays } from "@/lib/leave/days";
import type { LeaveType } from "@/types/db";
import { requestLeave } from "./actions";

export function RequestLeaveModal({
  leaveTypes,
  balances,
  onClose,
}: {
  leaveTypes: LeaveType[];
  balances: {
    leave_type_id: string;
    allocated_days: number;
    used_days: number;
    pending_days: number;
  }[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const bal = balances.find((b) => b.leave_type_id === leaveTypeId);
  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return countBusinessDays(startDate, endDate, halfDay);
  }, [startDate, endDate, halfDay]);

  const remaining = bal
    ? Number(bal.allocated_days) -
      Number(bal.used_days) -
      Number(bal.pending_days)
    : 0;

  const canSubmit =
    days > 0 &&
    (selectedType?.category === "unpaid" ||
      selectedType?.category === "sick" ||
      remaining >= days);

  async function submit() {
    setBusy(true);
    try {
      const result = await requestLeave({
        leaveTypeId,
        startDate,
        endDate,
        halfDay,
        note,
      });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <MotionModal
      open
      onClose={onClose}
      panelClassName="w-full max-w-md rounded-[var(--radius)] border bg-surface p-6 shadow-card"
    >
      <h2 className="text-lg font-semibold tracking-tightest">Request leave</h2>
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Leave type</span>
          <select
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className="h-10 rounded-[var(--radius)] border bg-surface px-3"
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Start date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="End date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
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
        <Input
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="rounded-[var(--radius)] border bg-[var(--accent-soft)]/30 p-3 text-sm">
          <p>
            Days requested:{" "}
            <span className="tnum font-semibold">{days || "—"}</span>
          </p>
          {selectedType?.category !== "unpaid" && (
            <p className="mt-1 text-muted">
              Remaining balance:{" "}
              <span className="tnum font-medium">{remaining}</span>
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
