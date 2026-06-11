"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import { prefersReducedMotion } from "@/lib/motion";

/**
 * Reusable number count-up for stats. Built now for later phases (dashboards).
 * Animates from 0 → `value` on mount; renders the final value immediately under
 * prefers-reduced-motion. Tabular figures via `.tnum`.
 */
export function CountUp({
  value,
  duration = 1.2,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(
    prefersReducedMotion() ? value : 0,
  );
  const ref = useRef({ n: 0 });

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const obj = ref.current;
    obj.n = 0;
    const tween = gsap.to(obj, {
      n: value,
      duration,
      ease: "power2.out",
      onUpdate: () => setDisplay(obj.n),
    });
    return () => {
      tween.kill();
    };
  }, [value, duration]);

  return (
    <span className={`tnum ${className ?? ""}`}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
