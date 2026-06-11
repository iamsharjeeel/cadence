/** Shared motion helpers (Framer Motion in app shell; GSAP on landing only). */

/** True when the user prefers reduced motion (SSR-safe). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

export const CARD_ENTRANCE = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

export const MODAL_PANEL = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

export const MODAL_BACKDROP = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

export const DROPDOWN_PANEL = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.1, ease: "easeOut" as const },
};

export const STAGGER_CONTAINER = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04 },
  },
};

export const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" as const },
  },
};
