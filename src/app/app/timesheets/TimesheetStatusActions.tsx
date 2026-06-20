"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { TimesheetStatus } from "@/types/db";
import { recallTimesheet, returnTimesheetToDraft } from "./actions";
import { requestTimesheetEdit } from "./time-actions";
import { computeTimesheetLifecycle } from "@/lib/timesheets/lifecycle";
import { MotionModal } from "@/components/motion/MotionModal";

/**
 * Status-change actions shown to the timesheet owner (or admin/superadmin):
 * - Submitted → "Recall" button → sets draft
 * - Rejected  → "Edit & resubmit" button → sets draft + navigates to log
 */
export function TimesheetStatusActions({
  id,
  status,
  periodStart,
  periodEnd,
  submittedAt,
  editRequestStatus,
  isOwner,
}: {
  id: string;
  status: TimesheetStatus;
  periodStart: string;
  periodEnd?: string;
  submittedAt?: string | null;
  editRequestStatus?: "pending" | "approved" | "rejected" | null;
  isOwner: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const lifecycle =
    status === "submitted" && periodEnd
      ? computeTimesheetLifecycle({
          status,
          periodEnd,
          submittedAt,
          editRequestStatus,
        })
      : null;

  if (!isOwner) return null;

  if (status === "submitted" && lifecycle?.stage === "submitted_editable") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await recallTimesheet(id);
            toast(res.message, res.ok ? "success" : "error");
            if (res.ok) router.refresh();
          } finally {
            setLoading(false);
          }
        }}
      >
        Recall
      </Button>
    );
  }

  if (status === "submitted" && lifecycle?.stage === "locked") {
    return (
      <>
        {editRequestStatus === "pending" ? (
          <span className="text-xs text-muted">Edit request pending</span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRequestOpen(true)}
          >
            Request edit
          </Button>
        )}
        <MotionModal
          open={requestOpen}
          onClose={() => {
            if (loading) return;
            setRequestOpen(false);
          }}
          panelClassName="max-w-md"
        >
          <h3 className="font-display text-base font-semibold text-ink">
            Request edit access
          </h3>
          <textarea
            rows={4}
            value={requestNote}
            maxLength={500}
            onChange={(event) => setRequestNote(event.target.value)}
            placeholder="Explain why this timesheet needs changes."
            className="mt-4 w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-surface px-3 py-2 text-sm text-ink"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => setRequestOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={loading}
              disabled={!requestNote.trim()}
              onClick={async () => {
                setLoading(true);
                try {
                  const result = await requestTimesheetEdit(id, requestNote.trim());
                  toast(result.message, result.ok ? "success" : "error");
                  if (result.ok) {
                    setRequestOpen(false);
                    setRequestNote("");
                    router.refresh();
                  }
                } finally {
                  setLoading(false);
                }
              }}
            >
              Send request
            </Button>
          </div>
        </MotionModal>
      </>
    );
  }

  if (status === "rejected") {
    return (
      <Button
        type="button"
        size="sm"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await returnTimesheetToDraft(id);
            toast(res.message, res.ok ? "success" : "error");
            if (res.ok) {
              router.push(`/app/timesheets/log?week=${periodStart}`);
            }
          } finally {
            setLoading(false);
          }
        }}
      >
        Edit &amp; resubmit
      </Button>
    );
  }

  return null;
}
