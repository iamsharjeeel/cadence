/**
 * Ref-counted body scroll lock — CSS-only via the `.modal-open` class
 * (defined in globals.css). Shared by every modal/overlay so stacked modals
 * don't prematurely unlock the body behind a still-open one. Never mutates
 * inline `document.body.style.overflow`, which forces a layout reflow.
 */
let lockCount = 0;

export function lockBodyScroll(): void {
  lockCount += 1;
  if (typeof document !== "undefined") {
    document.body.classList.add("modal-open");
  }
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && typeof document !== "undefined") {
    document.body.classList.remove("modal-open");
  }
}
