"use client";

import { AnimatePresence, motion } from "framer-motion";

import { MODAL_BACKDROP, MODAL_PANEL } from "@/lib/motion";
import { cn } from "@/lib/utils";

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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4",
            className,
          )}
          {...MODAL_BACKDROP}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            className={panelClassName}
            {...MODAL_PANEL}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
