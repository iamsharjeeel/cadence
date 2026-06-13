"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import { prefersReducedMotion } from "@/lib/motion";

/** Landing-page stats bar only — GSAP count-up on scroll into view. */
export function LandingCountUp({
  value,
  duration = 1,
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0);
  const [started, setStarted] = useState(false);
  const objRef = useRef({ n: 0 });
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!started) return;
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    objRef.current.n = 0;
    setDisplay(0);
    tweenRef.current?.kill();
    tweenRef.current = gsap.to(objRef.current, {
      n: value,
      duration,
      ease: "power2.out",
      onUpdate: () => setDisplay(objRef.current.n),
    });
    return () => {
      tweenRef.current?.kill();
    };
  }, [value, duration, started]);

  return (
    <span ref={ref} className={`tabular ${className ?? ""}`}>
      {Math.round(display)}
      {suffix}
    </span>
  );
}
