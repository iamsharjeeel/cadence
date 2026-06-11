"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import {
  DURATION,
  EASE,
  REVEAL_ITEM_CLASS,
  RISE,
  disablePointerEventsDuringAnim,
  enablePointerEvents,
  prefersReducedMotion,
} from "@/lib/motion";

/**
 * Staggered reveal for lists/cards on mount. Animates `.reveal-item` children
 * when present, otherwise direct children. Interactive descendants (links,
 * buttons) keep pointer-events throughout; animated shells release on complete.
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    const items = el.querySelectorAll(`.${REVEAL_ITEM_CLASS}`);
    const targets =
      items.length > 0
        ? Array.from(items)
        : el.children.length
          ? Array.from(el.children)
          : [el];

    disablePointerEventsDuringAnim(targets);

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y: RISE,
        duration: DURATION,
        ease: EASE,
        stagger,
        clearProps: "transform,opacity",
        onComplete: () => {
          enablePointerEvents(targets);
        },
      });
    }, el);

    return () => {
      enablePointerEvents(targets);
      ctx.revert();
    };
  }, [stagger]);

  return (
    <div ref={ref} className={className} style={{ pointerEvents: "auto" }}>
      {children}
    </div>
  );
}
