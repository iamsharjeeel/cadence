"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";

import {
  DURATION,
  EASE,
  INTERACTIVE_SELECTOR,
  RISE,
  enablePointerEvents,
  prefersReducedMotion,
} from "@/lib/motion";

/**
 * Route transition: fade + 8px rise, 300ms, power2.out. Re-runs whenever the
 * pathname changes. No-op under prefers-reduced-motion.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    el.querySelectorAll(INTERACTIVE_SELECTOR).forEach((child) => {
      (child as HTMLElement).style.pointerEvents = "auto";
    });

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: RISE },
        {
          opacity: 1,
          y: 0,
          duration: DURATION,
          ease: EASE,
          clearProps: "transform,opacity",
          onComplete: () => {
            enablePointerEvents(el);
          },
        },
      );
    }, el);

    return () => {
      enablePointerEvents(el);
      ctx.revert();
    };
  }, [pathname]);

  return (
    <div ref={ref} style={{ pointerEvents: "auto" }}>
      {children}
    </div>
  );
}
