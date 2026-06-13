"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 z-40", className)}>
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="fixed inset-0 bg-black/50"
            {...MODAL_BACKDROP}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            className={cn(
              "fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-2rem)] w-full -translate-x-1/2 -translate-y-1/2 p-4",
              panelClassName?.includes("max-w-") ? "" : "max-w-lg",
            )}
            {...MODAL_PANEL}
          >
            <div
              className={cn(MODAL_PANEL_CLASS, panelClassName)}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
