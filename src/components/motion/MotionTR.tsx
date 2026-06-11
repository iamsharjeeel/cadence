"use client";

import { motion } from "framer-motion";

import { TABLE_ROW_ENTRANCE } from "@/lib/motion";
import { cn } from "@/lib/utils";

const rowClass = "border-b last:border-0";

/** Table row — all rows fade in together at 120ms (no stagger). */
export function MotionTR({
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.tr
      {...TABLE_ROW_ENTRANCE}
      className={cn(rowClass, className)}
    >
      {children}
    </motion.tr>
  );
}
