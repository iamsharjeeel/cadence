"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

const SAVED_INDICATOR_MOTION = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0 },
};

export function SaveIndicator({
  state,
  error,
  onRetry,
}: {
  state: "idle" | "saving" | "saved" | "error";
  error?: string;
  onRetry?: () => void;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <motion.span
        {...SAVED_INDICATOR_MOTION}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)]"
      >
        <Check className="h-3 w-3" aria-hidden />
        Saved
      </motion.span>
    );
  }
  if (state === "error") {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">{error ?? "Couldn't save"}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  return null;
}
