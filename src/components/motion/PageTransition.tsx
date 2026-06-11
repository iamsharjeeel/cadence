"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

import { PAGE_TRANSITION } from "@/lib/motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname} className="w-full" {...PAGE_TRANSITION}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
