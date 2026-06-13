"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import type { TimesheetStatus } from "@/types/db";
import { deleteTimesheet } from "./actions";

export function DeleteTimesheetControl({
  id,
  status,
  canDelete,
  hasDocument,
  redirectTo,
}: {
  id: string;
  status: TimesheetStatus;
  canDelete: boolean;
  hasDocument?: boolean;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  if (!canDelete) return null;

  const isApproved = status === "approved";

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await deleteTimesheet(id);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setOpen(false);
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-[var(--danger)] hover:underline focus-visible:outline-none"
      >
        Delete
      </button>

      <MotionModal
        open={open}
        onClose={() => !loading && setOpen(false)}
        panelClassName="max-w-md rounded-card bg-[var(--surface)] shadow-float dark:border dark:border-[var(--accent)]"
      >
        <h3 className="font-display text-[18px] font-semibold tracking-tightest text-ink">
          Delete this timesheet?
        </h3>
        <p className="mt-2 font-body text-sm text-muted">
          This will permanently delete this timesheet and all its entries. This
          cannot be undone.
        </p>
        {isApproved && (
          <div className="mt-3 rounded-[calc(var(--radius-card)-4px)] bg-[var(--danger-soft)] px-4 py-3 font-body text-sm text-[var(--danger)]">
            This timesheet is approved. You are about to permanently delete an
            approved record.
          </div>
        )}
        {hasDocument && (
          <div className="mt-3 rounded-[calc(var(--radius-card)-4px)] border border-[var(--line)] px-4 py-3 font-body text-sm text-muted">
            A document has been generated for this timesheet. Deleting it will
            not delete the document.
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={loading}
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => void handleDelete()}
          >
            Delete
          </Button>
        </div>
      </MotionModal>
    </>
  );
}
