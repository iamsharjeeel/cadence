"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { cancelOrgInvite } from "./remove-actions";

export function CancelInviteButton({
  inviteId,
  email,
}: {
  inviteId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleCancel() {
    setLoading(true);
    try {
      const result = await cancelOrgInvite(inviteId);
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
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Cancel invite
      </Button>

      <MotionModal open={open} onClose={() => !loading && setOpen(false)}>
        <div className="w-full max-w-md rounded-[var(--radius-card)] border bg-surface p-6 shadow-card">
          <h3 className="font-display text-lg font-semibold tracking-tightest text-ink">
            Cancel invite?
          </h3>
          <p className="mt-2 text-sm text-muted">
            The pending invite to <span className="font-medium text-ink">{email}</span>{" "}
            will be removed. You can send a new invite anytime.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              Keep invite
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={loading}
              onClick={() => void handleCancel()}
            >
              Cancel invite
            </Button>
          </div>
        </div>
      </MotionModal>
    </>
  );
}
