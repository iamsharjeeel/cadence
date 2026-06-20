"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { MODAL_BACKDROP, MODAL_PANEL } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const MODAL_PANEL_CLASS =
  "w-full rounded-[var(--radius-card)] bg-surface p-5 shadow-float dark:rounded-none dark:border dark:border-[var(--accent)] dark:bg-[var(--surface)] dark:shadow-none";

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
  // Portal to <body> so the modal escapes any transformed ancestor
  // (PageTransition / MotionCard animate `y` → `transform`, which would
  // otherwise make `position: fixed` resolve against that box instead of the
  // viewport — the cause of off-center placement + hover flicker).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    // Sync mode: backdrop + panel are keyed children that animate together.
    <AnimatePresence>
      {open && (
        <motion.div
          key="cadence-modal-backdrop"
          aria-hidden="true"
          className="fixed inset-0 z-[100] bg-black/50"
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
            "pointer-events-none fixed inset-0 z-[101] flex items-center justify-center p-4",
            className,
          )}
          {...MODAL_PANEL}
        >
          {/* Single flex child carries the width constraint so justify-center
              actually centers it. max-w from panelClassName wins; otherwise
              default to max-w-lg. */}
          <div
            className={cn(
              "pointer-events-auto max-h-[calc(100vh-2rem)] w-full",
              panelClassName?.includes("max-w-") ? "" : "max-w-lg",
              MODAL_PANEL_CLASS,
              panelClassName,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
