"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import { DURATION, EASE, RISE, prefersReducedMotion } from "@/lib/motion";

/**
 * Staggered reveal for lists/cards on mount: direct children fade + rise 8px.
 * Respects prefers-reduced-motion (renders instantly, no transforms).
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

    const targets = el.children.length ? Array.from(el.children) : [el];
    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y: RISE,
        duration: DURATION,
        ease: EASE,
        stagger,
        clearProps: "transform,opacity",
      });
    }, el);

    return () => ctx.revert();
  }, [stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
