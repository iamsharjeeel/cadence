"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Replaces the old fabricated testimonials with an honest, deeper product
 * showcase: the persistent floating timer and the period lifecycle, both
 * rendered as custom-styled mockups (not screenshots) using the app's own
 * design tokens. Every label here reflects something Cadence actually does.
 */

const LIFECYCLE = [
  { label: "Log", sub: "All period long" },
  { label: "Submit", sub: "At period close" },
  { label: "Locked", sub: "Trusted record" },
] as const;

export function ProductShowcase() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden border border-line bg-surface-low p-6 shadow-card sm:p-10 [border-radius:var(--radius-card)]"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="inline-flex items-center gap-2 border border-line bg-surface px-3 py-1 font-body text-xs font-medium text-muted [border-radius:var(--radius-chip)]">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            One record, start to finish
          </p>
          <h3 className="mt-5 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
            Log as you go. Submit when it&rsquo;s done.
          </h3>
          <p className="mt-4 max-w-md font-body leading-relaxed text-muted">
            A persistent floating timer auto-fills your entries while you work.
            Add hours all period long, copy a day across the rest in one click,
            then submit for approval at the close. Approved time locks into a
            record everyone can trust.
          </p>

          <div className="mt-8 flex items-stretch gap-2">
            {LIFECYCLE.map((stage, i) => (
              <motion.div
                key={stage.label}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.1 + i * 0.1 }}
                className="flex-1 border border-line bg-surface p-3 [border-radius:var(--radius-input)]"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      i === 2 ? "bg-accent" : "bg-[var(--accent-mid)]"
                    }`}
                  />
                  <span className="font-display text-sm font-semibold text-ink">
                    {stage.label}
                  </span>
                </div>
                <p className="mt-1 font-body text-[11px] leading-tight text-muted">
                  {stage.sub}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* custom floating-timer + timesheet mockup */}
        <div className="relative">
          <div className="border border-line bg-surface p-4 shadow-card [border-radius:var(--radius-card)] sm:p-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="font-display text-sm font-semibold text-ink">
                This week
              </span>
              <span className="font-body text-xs text-muted">Mon–Sun</span>
            </div>

            <div className="mt-3 space-y-2">
              {[
                { day: "Mon", proj: "Acme — Redesign", hrs: "7.5", live: false },
                { day: "Tue", proj: "Acme — Redesign", hrs: "8.0", live: false },
                { day: "Wed", proj: "Internal — Ops", hrs: "6.0", live: false },
                { day: "Thu", proj: "Acme — Redesign", hrs: "2.3", live: true },
              ].map((row) => (
                <div
                  key={row.day}
                  className="flex items-center gap-3 border border-line bg-surface-low px-3 py-2 [border-radius:var(--radius-input)]"
                >
                  <span className="w-8 font-display text-xs font-semibold text-muted">
                    {row.day}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-body text-xs text-ink">
                    {row.proj}
                  </span>
                  {row.live && (
                    <span className="hidden items-center gap-1 font-body text-[10px] uppercase tracking-wide text-[var(--accent-mid)] sm:inline-flex">
                      <span className="relative flex h-1.5 w-1.5">
                        <motion.span
                          className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent-mid)]"
                          animate={reduce ? undefined : { opacity: [1, 0.2, 1] }}
                          transition={{ duration: 1.6, repeat: Infinity }}
                        />
                      </span>
                      live
                    </span>
                  )}
                  <span className="font-display text-xs font-semibold tabular text-ink">
                    {row.hrs}h
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* the draggable floating timer widget */}
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.9, y: 8 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
            className="absolute -bottom-5 -right-3 flex items-center gap-3 border border-line bg-surface px-4 py-3 shadow-float [border-radius:var(--radius-card)] sm:-right-5"
          >
            <span className="relative flex h-2.5 w-2.5">
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full bg-accent"
                animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
            </span>
            <span className="font-display text-lg font-semibold tabular text-ink">
              02:14:08
            </span>
            <span
              className="grid h-7 w-7 place-items-center bg-accent text-[var(--background)] [border-radius:var(--radius-input)]"
              aria-hidden
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="1" width="10" height="10" />
              </svg>
            </span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
