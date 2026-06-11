/** Shared motion config so every animation reads from one place. */
export const EASE = "power2.out";
export const DURATION = 0.3;
export const RISE = 8; // px

/** True when the user prefers reduced motion (SSR-safe). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
