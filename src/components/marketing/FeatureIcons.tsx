/**
 * Bespoke Cadence feature icons — one cohesive line system.
 *
 * Shared traits: 28×28 grid, 1.4 stroke, square caps + miter joins (sharp,
 * not soft), `currentColor` so the parent controls colour, and a single
 * accent-filled node per glyph used purposefully (never decoratively).
 * These are hand-built for Cadence, not pulled from an icon library.
 */

type IconProps = { className?: string };

const SVG = {
  width: 28,
  height: 28,
  viewBox: "0 0 28 28",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "square" as const,
  strokeLinejoin: "miter" as const,
};

/** Direct time logging + floating timer widget. */
export function IconTimer({ className }: IconProps) {
  return (
    <svg {...SVG} className={className} aria-hidden>
      <circle cx="14" cy="15" r="8" />
      <path d="M14 15V10" />
      <path d="M14 15l3.5 2.2" />
      <path d="M11 4h6" />
      {/* the draggable widget node */}
      <circle cx="14" cy="6.4" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Flexible periods — week, 15-day, monthly. */
export function IconPeriods({ className }: IconProps) {
  return (
    <svg {...SVG} className={className} aria-hidden>
      <rect x="4" y="6" width="20" height="17" />
      <path d="M4 11h20" />
      <path d="M9 6V3.5" />
      <path d="M19 6V3.5" />
      {/* three period widths */}
      <path d="M7 15h3" />
      <path d="M7 19h6" />
      <path d="M16 15h5" stroke="currentColor" />
      <rect x="16" y="18" width="5" height="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Full lifecycle — log, submit, lock. */
export function IconLifecycle({ className }: IconProps) {
  return (
    <svg {...SVG} className={className} aria-hidden>
      <path d="M5 9.5a9 9 0 1 1-1.2 8" />
      <path d="M5 5v4.5h4.5" />
      {/* lock at the end of the flow */}
      <rect x="11.5" y="14.5" width="7" height="5.5" />
      <path d="M13 14.5v-1.6a2 2 0 0 1 4 0v1.6" />
      <circle cx="15" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Per-entry copy — log one day, fill the period. */
export function IconCopy({ className }: IconProps) {
  return (
    <svg {...SVG} className={className} aria-hidden>
      <rect x="4" y="4" width="12" height="12" />
      <path d="M19 9h5v15H9v-5" />
      <path d="M13 19h6" />
      <path d="M13 22h6" />
      <rect x="7" y="7" width="6" height="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Connected work — Asana projects + Google Calendar sync. */
export function IconConnected({ className }: IconProps) {
  return (
    <svg {...SVG} className={className} aria-hidden>
      <circle cx="6" cy="14" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="21" cy="6.5" r="2.5" />
      <circle cx="21" cy="21.5" r="2.5" />
      <path d="M8.2 12.6l10.6-4.7" />
      <path d="M8.2 15.4l10.6 4.7" />
    </svg>
  );
}

/** Full provenance — Time Tracked history + secure documents. */
export function IconProvenance({ className }: IconProps) {
  return (
    <svg {...SVG} className={className} aria-hidden>
      <path d="M6 4h10l6 6v14H6z" />
      <path d="M16 4v6h6" />
      <path d="M10 15h8" />
      <path d="M10 19h5" />
      <circle cx="10.5" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
