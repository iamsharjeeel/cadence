"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import {
  DURATION,
  EASE,
  REVEAL_ITEM_CLASS,
  RISE,
  enablePointerEvents,
  prefersReducedMotion,
} from "@/lib/motion";

/**
 * Staggered reveal for lists/cards — runs once on initial mount only.
 * Interactive descendants are never left with pointer-events disabled.
 */
export function Reveal({
  children,
  stagger = 0.06,
  className,
}: {
  children: React.ReactNode;
  stagger?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasAnimated.current) return;

    const items = el.querySelectorAll(`.${REVEAL_ITEM_CLASS}`);
    const targets =
      items.length > 0
        ? Array.from(items)
        : el.children.length
          ? Array.from(el.children)
          : [el];

    if (prefersReducedMotion()) {
      hasAnimated.current = true;
      enablePointerEvents(targets);
      gsap.set(targets, { opacity: 1, y: 0, pointerEvents: "auto" });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y: RISE,
        duration: DURATION,
        ease: EASE,
        stagger,
        clearProps: "transform,opacity",
        onComplete: () => {
          hasAnimated.current = true;
          enablePointerEvents(targets);
          targets.forEach((node) => {
            gsap.set(node, { opacity: 1, y: 0, pointerEvents: "auto" });
          });
        },
      });
    }, el);

    return () => {
      enablePointerEvents(targets);
      if (!hasAnimated.current) {
        ctx.revert();
      } else {
        ctx.kill();
      }
    };
  }, [stagger]);

  return (
    <div ref={ref} className={className} style={{ pointerEvents: "auto" }}>
      {children}
    </div>
  );
}
