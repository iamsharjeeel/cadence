/** Shared motion config so every animation reads from one place. */
export const EASE = "power2.out";
export const DURATION = 0.3;
export const RISE = 8; // px

/** Class applied to elements Reveal animates (wraps interactive content). */
export const REVEAL_ITEM_CLASS = "reveal-item";

/** Selectors that must stay clickable even while a parent is animating. */
export const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, [role='button'], [tabindex], label";

/** True when the user prefers reduced motion (SSR-safe). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Ensures animated nodes and their interactive descendants accept clicks. */
export function enablePointerEvents(root: Element | Element[]): void {
  const nodes = Array.isArray(root) ? root : [root];
  for (const node of nodes) {
    const el = node as HTMLElement;
    el.style.pointerEvents = "auto";
    el.querySelectorAll(INTERACTIVE_SELECTOR).forEach((child) => {
      (child as HTMLElement).style.pointerEvents = "auto";
    });
  }
}

/** Disables pointer events on animated shells; children stay interactive. */
export function disablePointerEventsDuringAnim(root: Element | Element[]): void {
  const nodes = Array.isArray(root) ? root : [root];
  for (const node of nodes) {
    const el = node as HTMLElement;
    el.style.pointerEvents = "none";
    el.querySelectorAll(INTERACTIVE_SELECTOR).forEach((child) => {
      (child as HTMLElement).style.pointerEvents = "auto";
    });
  }
}
