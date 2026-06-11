"use client";

import { motion } from "framer-motion";

import { STAT_STAGGER_CONTAINER, STAT_STAGGER_ITEM } from "@/lib/motion";

/** Stagger wrapper for dashboard stat cards (max 3, 40ms apart). */
export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-3"
      variants={STAT_STAGGER_CONTAINER}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
    >
      {children}
    </motion.div>
  );
}

export function StatCardItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={STAT_STAGGER_ITEM}>{children}</motion.div>;
}
