"use client";

import { motion } from "framer-motion";

import { CARD_ENTRANCE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function MotionCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--line)] bg-surface shadow-card transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-float [--card-pad-x:1rem] [--card-pad-y:0.875rem] [--card-footer-y:0.75rem] [--card-title-size:1rem]",
        className,
      )}
      {...CARD_ENTRANCE}
    >
      {children}
    </motion.div>
  );
}
