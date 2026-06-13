"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

/**
 * Inline disconnect confirm — first click reveals "Are you sure?" with
 * Confirm / Cancel. No modal, no backdrop, no layout shift.
 */
export function InlineDisconnect({
  confirmText,
  onConfirm,
  pending,
}: {
  confirmText: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-[var(--danger)] transition-opacity hover:opacity-80"
      >
        Disconnect
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-ink">{confirmText}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          loading={pending}
          onClick={onConfirm}
        >
          Confirm
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
