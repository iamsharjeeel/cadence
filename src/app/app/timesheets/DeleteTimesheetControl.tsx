"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { MotionModal } from "@/components/motion/MotionModal";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { useToast } from "@/components/ui/Toast";
import type { TimesheetStatus } from "@/types/db";
import { deleteTimesheet } from "./actions";

export function DeleteTimesheetControl({
  id,
  status,
  canDelete,
}: {
  id: string;
  status: TimesheetStatus;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  if (!canDelete || (status !== "draft" && status !== "rejected")) {
    return null;
  }

  return (
    <>
      <RowActionsMenu
        actions={[
          {
            label: "Delete",
            destructive: true,
            onClick: () => setOpen(true),
          },
        ]}
      />
      <MotionModal open={open} onClose={() => setOpen(false)}>
        <div className="w-full max-w-md rounded-[var(--radius)] border bg-surface p-6 shadow-card">
          <h3 className="font-display text-lg font-semibold tracking-tightest">
            Delete this timesheet?
          </h3>
          <p className="mt-2 text-sm text-muted">
            This will permanently remove all time entries for this period.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteTimesheet(id);
                  toast(res.message, res.ok ? "success" : "error");
                  if (res.ok) {
                    setOpen(false);
                    router.refresh();
                  }
                })
              }
            >
              Delete
            </Button>
          </div>
        </div>
      </MotionModal>
    </>
  );
}
