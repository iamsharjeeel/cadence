"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import { prefersReducedMotion } from "@/lib/motion";

/**
 * Number count-up for stats. Animates from 0 → `value` on mount, or when scrolled
 * into view if `startOnView` is set. Renders final value immediately under
 * prefers-reduced-motion.
 */
export function CountUp({
  value,
  duration = 1.2,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  startOnView = false,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** When true, animation starts on first intersection (for landing stats). */
  startOnView?: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef<HTMLSpanElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const objRef = useRef({ n: 0 });

  useEffect(() => {
    if (!startOnView || started) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnView, started]);

  useEffect(() => {
    if (!started) return;

    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    const obj = objRef.current;
    obj.n = 0;
    setDisplay(0);
    tweenRef.current?.kill();
    tweenRef.current = gsap.to(obj, {
      n: value,
      duration,
      ease: "power2.out",
      onUpdate: () => setDisplay(obj.n),
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [value, duration, started]);

  return (
    <span ref={ref} className={`tnum ${className ?? ""}`}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
