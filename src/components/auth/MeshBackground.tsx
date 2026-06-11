/**
 * Quiet animated mesh-gradient backdrop for auth screens. Pure CSS (no
 * Three.js): two soft radial blooms drifting under a grain overlay. The drift
 * animation is disabled by `prefers-reduced-motion` via the global CSS reset.
 */
export function MeshBackground() {
  return (
    <div
      aria-hidden
      className="grain pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute -left-1/4 -top-1/4 h-[70vh] w-[70vh] rounded-full opacity-70 blur-3xl motion-safe:animate-mesh-drift"
        style={{
          background:
            "radial-gradient(circle at center, var(--accent-soft), transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[60vh] w-[60vh] rounded-full opacity-60 blur-3xl motion-safe:animate-mesh-drift"
        style={{
          animationDelay: "-9s",
          background:
            "radial-gradient(circle at center, rgba(31,138,138,0.18), transparent 70%)",
        }}
      />
    </div>
  );
}
