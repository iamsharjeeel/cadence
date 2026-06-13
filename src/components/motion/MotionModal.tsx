"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { MODAL_BACKDROP, MODAL_PANEL } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const MODAL_PANEL_CLASS =
  "w-full rounded-[var(--radius-card)] bg-surface p-6 shadow-float dark:rounded-none dark:border dark:border-[var(--accent)] dark:bg-[var(--surface)] dark:shadow-none";

export function MotionModal({
  open,
  onClose,
  children,
  className,
  panelClassName,
}: {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          key="cadence-modal-backdrop"
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50"
          {...MODAL_BACKDROP}
          onClick={onClose}
        />
      )}
      {open && (
        <motion.div
          key="cadence-modal-panel"
          role="dialog"
          aria-modal="true"
          className={cn(
            "pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4",
            className,
          )}
          {...MODAL_PANEL}
        >
          <div
            className={cn(
              "pointer-events-auto max-h-[calc(100vh-2rem)] w-full",
              panelClassName?.includes("max-w-") ? "" : "max-w-lg",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn(MODAL_PANEL_CLASS, panelClassName)}>{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
