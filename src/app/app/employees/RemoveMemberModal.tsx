"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { removeMemberFromOrg } from "./remove-actions";

export function RemoveMemberModal({
  memberId,
  memberName,
  memberEmail,
}: {
  memberId: string;
  memberName: string;
  memberEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleRemove() {
    setLoading(true);
    try {
      const result = await removeMemberFromOrg(memberId);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setOpen(false);
        router.refresh();
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
        Remove from org
      </button>

      <MotionModal open={open} onClose={() => !loading && setOpen(false)}>
        <div className="w-full max-w-md rounded-[var(--radius)] border bg-surface p-6 shadow-card">
          <div className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-[var(--accent)]" aria-hidden />
            <h3 className="font-display text-lg font-semibold tracking-tightest text-ink">
              Remove from organization?
            </h3>
          </div>
          <p className="mt-3 text-sm text-muted">
            <span className="font-medium text-ink">{memberName}</span> (
            {memberEmail}) will lose access to this organization. Their Cadence
            account, timesheets, and documents are preserved — only membership is
            removed. They can be re-invited later.
          </p>
          <p className="mt-2 text-xs text-muted">
            This does not delete their account (full account deletion is a
            separate GDPR process).
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={loading}
              onClick={() => void handleRemove()}
            >
              Remove from org
            </Button>
          </div>
        </div>
      </MotionModal>
    </>
  );
}
