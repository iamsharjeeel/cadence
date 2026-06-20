"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * Bespoke hero visual — one personal node (left) expanding into a connected
 * organisation (right). It carries the single most distinctive idea about
 * Cadence: you start solo, the same account scales to a team. Rendered in the
 * gold/dark palette via CSS tokens so it adapts to light + dark automatically.
 *
 * Motion is intentionally quiet: connectors draw in once on view, nodes settle
 * in with a soft stagger, the personal node breathes, and the whole scene
 * parallaxes a few pixels under the pointer. All of it disables under
 * `prefers-reduced-motion`.
 */

const TEAM_NODES = [
  { cx: 360, cy: 96 },
  { cx: 452, cy: 150 },
  { cx: 470, cy: 256 },
  { cx: 388, cy: 320 },
  { cx: 300, cy: 250 },
  { cx: 318, cy: 150 },
] as const;

const PERSONAL = { cx: 150, cy: 210 } as const;

export function HeroArt() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 60, damping: 18, mass: 0.6 });

  // Personal side moves opposite/less than the team side for gentle depth.
  const teamX = useTransform(sx, (v) => v * 1);
  const teamY = useTransform(sy, (v) => v * 1);
  const personalX = useTransform(sx, (v) => v * -0.4);
  const personalY = useTransform(sy, (v) => v * -0.4);

  function onMove(e: React.MouseEvent) {
    if (reduce) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    px.set(nx * 16);
    py.set(ny * 16);
  }

  function onLeave() {
    px.set(0);
    py.set(0);
  }

  const drawn = { pathLength: 1, opacity: 1 };

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative w-full select-none"
      aria-hidden
    >
      <svg
        viewBox="0 0 540 420"
        className="h-auto w-full overflow-visible"
        role="presentation"
      >
        <defs>
          <radialGradient id="cad-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--accent-mid)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent-mid)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cad-link" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-mid)" stopOpacity="0.65" />
            <stop offset="100%" stopColor="var(--accent-mid)" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* faint atmospheric glow behind the personal node */}
        <circle cx={PERSONAL.cx} cy={PERSONAL.cy} r="150" fill="url(#cad-glow)" />

        {/* connectors: personal -> team */}
        <motion.g
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          {TEAM_NODES.map((n, i) => (
            <motion.line
              key={`spoke-${i}`}
              x1={PERSONAL.cx}
              y1={PERSONAL.cy}
              x2={n.cx}
              y2={n.cy}
              stroke="url(#cad-link)"
              strokeWidth="1.4"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              whileInView={drawn}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.08, ease: "easeOut" }}
            />
          ))}
          {/* a few intra-team links so it reads as a connected org */}
          {[
            [TEAM_NODES[0], TEAM_NODES[1]],
            [TEAM_NODES[1], TEAM_NODES[2]],
            [TEAM_NODES[2], TEAM_NODES[3]],
            [TEAM_NODES[5], TEAM_NODES[0]],
          ].map(([a, b], i) => (
            <motion.line
              key={`mesh-${i}`}
              x1={a.cx}
              y1={a.cy}
              x2={b.cx}
              y2={b.cy}
              stroke="var(--accent-mid)"
              strokeOpacity="0.2"
              strokeWidth="1"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              whileInView={drawn}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 + i * 0.08, ease: "easeOut" }}
            />
          ))}
        </motion.g>

        {/* team / organisation cluster */}
        <motion.g style={{ x: teamX, y: teamY }}>
          {TEAM_NODES.map((n, i) => (
            <motion.g
              key={`node-${i}`}
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.45,
                delay: 0.3 + i * 0.07,
                ease: "easeOut",
              }}
              style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
            >
              <circle
                cx={n.cx}
                cy={n.cy}
                r="13"
                fill="var(--surface)"
                stroke="var(--accent-mid)"
                strokeWidth="1.4"
              />
              <circle
                cx={n.cx}
                cy={n.cy}
                r="4"
                fill="var(--accent-mid)"
                fillOpacity={i % 2 === 0 ? 0.9 : 0.45}
              />
            </motion.g>
          ))}
        </motion.g>

        {/* personal node — the workspace you get on day one */}
        <motion.g style={{ x: personalX, y: personalY }}>
          {/* breathing rings = the personal workspace boundary */}
          <motion.circle
            cx={PERSONAL.cx}
            cy={PERSONAL.cy}
            r="54"
            fill="none"
            stroke="var(--accent-mid)"
            strokeOpacity="0.25"
            strokeWidth="1"
            initial={reduce ? false : { scale: 0.92, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ transformOrigin: `${PERSONAL.cx}px ${PERSONAL.cy}px` }}
          />
          <motion.circle
            cx={PERSONAL.cx}
            cy={PERSONAL.cy}
            r="38"
            fill="none"
            stroke="var(--accent-mid)"
            strokeOpacity="0.4"
            strokeWidth="1.2"
            animate={
              reduce
                ? undefined
                : { scale: [1, 1.05, 1], opacity: [0.4, 0.2, 0.4] }
            }
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: `${PERSONAL.cx}px ${PERSONAL.cy}px` }}
          />
          <circle
            cx={PERSONAL.cx}
            cy={PERSONAL.cy}
            r="24"
            fill="var(--accent-mid)"
          />
          <circle
            cx={PERSONAL.cx}
            cy={PERSONAL.cy}
            r="24"
            fill="none"
            stroke="var(--background)"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
          {/* a single mark inside = "you" */}
          <circle
            cx={PERSONAL.cx}
            cy={PERSONAL.cy - 4}
            r="5"
            fill="var(--background)"
          />
          <path
            d={`M${PERSONAL.cx - 9} ${PERSONAL.cy + 11} a9 9 0 0 1 18 0`}
            fill="var(--background)"
          />
        </motion.g>
      </svg>
    </div>
  );
}
