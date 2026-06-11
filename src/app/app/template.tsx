"use client";

import { PageTransition } from "@/components/motion/PageTransition";

/** Re-mounts page content on navigation; shell stays mounted in layout. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
