"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

const rowClass = "border-b last:border-0";

/** Table row with first-mount stagger (max 8 animated). */
export function MotionTR({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  const delay = index < 8 ? index * 0.04 : 0;

  if (index >= 8) {
    return <tr className={cn(rowClass, className)}>{children}</tr>;
  }

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.15, delay, ease: "easeOut" }}
      className={cn(rowClass, className)}
    >
      {children}
    </motion.tr>
  );
}
