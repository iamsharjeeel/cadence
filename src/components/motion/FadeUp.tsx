"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * CSS-only fade-up for decorative, non-interactive shells. Adds `.fade-up-active`
 * once on mount — never replays. Do not wrap buttons, cards, links, or table rows.
 */
export function FadeUp({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in seconds */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (armed.current || !ref.current) return;
    armed.current = true;
    ref.current.style.animationDelay = `${delay}s`;
    ref.current.classList.add("fade-up-active");
  }, [delay]);

  return (
    <div ref={ref} className={cn("fade-up", className)}>
      {children}
    </div>
  );
}

/** Staggered fade-up children — decorative grids only. */
export function FadeUpStagger({
  children,
  className,
  stagger = 0.06,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (armed.current || !ref.current) return;
    armed.current = true;
    const items = ref.current.children;
    Array.from(items).forEach((el, i) => {
      const node = el as HTMLElement;
      node.classList.add("fade-up");
      node.style.animationDelay = `${i * stagger}s`;
      node.classList.add("fade-up-active");
    });
  }, [stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
