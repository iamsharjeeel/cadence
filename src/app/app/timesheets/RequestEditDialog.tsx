"use client";

import { Button } from "@/components/ui/Button";

export function RequestEditDialog({
  open,
  note,
  onNoteChange,
  onClose,
  onSave,
}: {
  open: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] bg-surface p-6 shadow-float">
        <h3 className="font-display text-base font-semibold text-ink">Note edit request</h3>
        <p className="mt-1 text-sm text-muted">
          Locked timesheets stay read-only. Your note is recorded in the audit trail
          for record-keeping only — it does not unlock this timesheet.
        </p>
        <textarea
          className="mt-3 w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-surface p-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          rows={3}
          placeholder="Optional note for your records…"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" onClick={onSave}>Save note</Button>
        </div>
      </div>
    </div>
  );
}
