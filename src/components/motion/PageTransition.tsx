"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";

import {
  DURATION,
  EASE,
  RISE,
  enablePointerEvents,
  prefersReducedMotion,
} from "@/lib/motion";

/**
 * Route transition: fade + rise once per pathname visit. Re-runs only when the
 * pathname changes — not on parent re-renders or router.refresh().
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lastAnimatedPath = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Same route re-render (e.g. refresh) — keep content interactive, skip replay.
    if (lastAnimatedPath.current === pathname) {
      enablePointerEvents(el);
      gsap.set(el, { opacity: 1, y: 0, pointerEvents: "auto" });
      return;
    }

    if (prefersReducedMotion()) {
      lastAnimatedPath.current = pathname;
      enablePointerEvents(el);
      gsap.set(el, { opacity: 1, y: 0, pointerEvents: "auto" });
      return;
    }

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
            lastAnimatedPath.current = pathname;
            enablePointerEvents(el);
            gsap.set(el, { opacity: 1, y: 0, pointerEvents: "auto" });
          },
        },
      );
    }, el);

    return () => {
      enablePointerEvents(el);
      if (lastAnimatedPath.current !== pathname) {
        ctx.revert();
      } else {
        ctx.kill();
      }
    };
  }, [pathname]);

  return (
    <div ref={ref} style={{ pointerEvents: "auto" }}>
      {children}
    </div>
  );
}
