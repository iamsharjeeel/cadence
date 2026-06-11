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
        "rounded-[var(--radius)] border bg-surface shadow-card transition-[box-shadow] duration-150 ease-out hover:shadow-lg",
        className,
      )}
      {...CARD_ENTRANCE}
    >
      {children}
    </motion.div>
  );
}
