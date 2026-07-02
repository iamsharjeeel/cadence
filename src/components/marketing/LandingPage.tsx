"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { Wordmark } from "@/components/brand/Wordmark";
import { LandingCountUp } from "@/components/motion/LandingCountUp";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonStyles } from "@/components/ui/buttonStyles";

import { HeroArt } from "./HeroArt";
import { ProductShowcase } from "./ProductShowcase";
import {
  IconConnected,
  IconCopy,
  IconLifecycle,
  IconPeriods,
  IconProvenance,
  IconTimer,
} from "./FeatureIcons";

const FEATURES = [
  {
    Icon: IconTimer,
    title: "Log time directly",
    description:
      "A persistent, draggable floating timer auto-fills your entries as you work. No spreadsheets, no uploads, no imports.",
  },
  {
    Icon: IconPeriods,
    title: "Periods that fit you",
    description:
      "Track by week, 15 days, or month — your choice from day one. Works the same whether you're solo or inside an organization.",
  },
  {
    Icon: IconLifecycle,
    title: "One clean lifecycle",
    description:
      "Log all period long, submit for approval at the close, then it locks into a record everyone can rely on.",
  },
  {
    Icon: IconCopy,
    title: "Copy a day, fill the period",
    description:
      "Log a single day and copy it across the rest of the week or period in one click — built for fast, repeated logging.",
  },
  {
    Icon: IconConnected,
    title: "Connected to your work",
    description:
      "Sync projects from Asana so entries link to real work, and keep Google Calendar events and time off in one view.",
  },
  {
    Icon: IconProvenance,
    title: "Provenance, not guesswork",
    description:
      "Every entry shows whether it was timer-logged or entered by hand, with filterable history and secure per-user documents.",
  },
] as const;

const INTEGRATIONS = ["Asana", "Google Calendar"] as const;

const STATS = [
  { value: 3, suffix: "", label: "period lengths — week, 15-day, or monthly" },
  { value: 2, suffix: "", label: "native integrations — Asana & Google Calendar" },
  { value: 1, suffix: "", label: "account that scales from you to your whole team" },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Sign up",
    description:
      "Get a complete personal workspace the moment you join. No team, no setup, no waiting for an invite.",
  },
  {
    step: "02",
    title: "Start logging",
    description:
      "Track hours with the timer or by hand, choose your period, copy days across it, and request time off.",
  },
  {
    step: "03",
    title: "Grow with your team",
    description:
      "Create or join an organization for approvals, roles, and shared projects. Same account — no re-onboarding.",
  },
] as const;

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  const reduce = useReducedMotion();

  function scrollToHow() {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-body">
      <header className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <Wordmark />
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className={`${buttonStyles("ghost", "sm")} min-h-11 min-w-11 px-4`}
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className={`${buttonStyles("primary", "sm")} min-h-11 px-4`}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ---------------------------------------------------------------- Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-60"
            aria-hidden
            style={{
              background:
                "radial-gradient(60% 50% at 78% 30%, var(--accent-soft), transparent 70%)",
            }}
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h1 className="mt-6 font-display text-[40px] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[64px]">
                <motion.span
                  className="block"
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 }}
                >
                  Complete time tracking,
                </motion.span>
                <motion.span
                  className="block text-[var(--accent-mid)]"
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.13 }}
                >
                  solo or with your team.
                </motion.span>
              </h1>

              <motion.p
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="mt-6 max-w-xl font-body text-lg leading-relaxed text-muted"
              >
                Every Cadence account ships complete from day one — log hours,
                track periods, manage time off, connect your calendar. Use it
                entirely on your own, or bring in a team for a full org
                platform with Manager roles, approval workflows, and
                shared projects. One account, either way.
              </motion.p>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.27 }}
                className="mt-9 flex flex-wrap items-center gap-3"
              >
                <Link
                  href="/login"
                  className={`${buttonStyles("primary", "md")} min-h-11`}
                >
                  Get started
                </Link>
                <button
                  type="button"
                  onClick={scrollToHow}
                  className={`${buttonStyles("secondary", "md")} min-h-11`}
                >
                  See how it works
                </button>
              </motion.div>

              <p className="mt-8 font-playfair text-base italic text-muted/80">
                Time, tracked with rhythm.
              </p>
            </div>

            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="mx-auto w-full max-w-md lg:max-w-none"
            >
              <HeroArt />
            </motion.div>
          </div>
        </section>

        {/* ------------------------------------------------------------ Trust bar */}
        <section className="border-y border-line bg-surface/40 px-6 py-7 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8">
            <p className="font-body text-xs font-medium uppercase tracking-widest text-muted">
              Connects with the tools you already use
            </p>
            <div className="flex items-center gap-6">
              {INTEGRATIONS.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ink"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-mid)]" />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- Features */}
        <section id="features" className="bg-background px-6 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
                Everything you need to track time — and nothing you don&rsquo;t.
              </h2>
              <p className="mt-4 max-w-xl font-body text-muted">
                Every feature works fully on day one as a solo user. Every
                feature scales into a complete org platform when your team joins.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-px overflow-hidden border border-line bg-line [border-radius:var(--radius-card)] sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 0.06}>
                  <div className="group flex h-full flex-col bg-surface p-7 transition-colors hover:bg-surface-low">
                    <span className="mb-5 inline-flex h-11 w-11 items-center justify-center bg-[var(--accent-soft)] text-[var(--accent-mid)] [border-radius:var(--radius-input)]">
                      <f.Icon className="h-6 w-6" />
                    </span>
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {f.title}
                    </h3>
                    <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                      {f.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- Stats */}
        <section className="border-y border-line bg-surface-low px-6 py-16 sm:px-8">
          <div className="mx-auto grid max-w-5xl gap-10 text-center sm:grid-cols-3">
            {STATS.map((s) => (
              <Reveal key={s.label}>
                <p className="font-display text-[56px] font-bold leading-none tabular text-[var(--accent-mid)]">
                  <LandingCountUp value={s.value} suffix={s.suffix} duration={1} />
                </p>
                <p className="mx-auto mt-3 max-w-[14rem] font-body text-sm leading-snug text-muted">
                  {s.label}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- Showcase */}
        <section className="px-6 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <ProductShowcase />
          </div>
        </section>

        {/* --------------------------------------------------------- How it works */}
        <section
          id="how-it-works"
          className="border-t border-line bg-background px-6 py-20 sm:px-8 sm:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
                From solo to a team, on one account
              </h2>
              <p className="mt-4 max-w-xl font-body text-muted">
                Start the day you sign up, no org required. Bring a team in
                for the full platform — approvals, roles, shared projects —
                whenever the time is right.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-10 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.step} delay={i * 0.08}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-3xl font-bold tabular text-[var(--accent-mid)]">
                        {s.step}
                      </span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                    <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                      {s.title}
                    </h3>
                    <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                      {s.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ Final CTA */}
        <section className="px-6 pb-24 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <div className="relative overflow-hidden border border-line bg-surface px-6 py-16 text-center shadow-card [border-radius:var(--radius-card)] sm:px-8 sm:py-20">
                <div
                  className="pointer-events-none absolute inset-0 opacity-70"
                  aria-hidden
                  style={{
                    background:
                      "radial-gradient(50% 60% at 50% 0%, var(--accent-soft), transparent 70%)",
                  }}
                />
                <div className="relative">
                  <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
                    Start with your own workspace today.
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg font-body text-muted">
                    Use it solo, or scale up to a full team with roles, approvals,
                    and org-wide projects — the account works completely either
                    way.
                  </p>
                  <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/login"
                      className={`${buttonStyles("primary", "md")} min-h-11`}
                    >
                      Get started
                    </Link>
                    <Link
                      href="/login"
                      className={`${buttonStyles("secondary", "md")} min-h-11`}
                    >
                      Sign in
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface-low px-6 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 font-body text-sm text-muted">
              Time, tracked with rhythm.
            </p>
            <p className="mt-1 font-body text-xs text-muted">
              Time tracking, payroll, and HR for individuals and teams.
            </p>
          </div>
          <div className="flex flex-col gap-2 font-body text-sm text-muted sm:items-end">
            <div className="flex flex-wrap gap-4">
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center hover:text-ink"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="inline-flex min-h-11 items-center hover:text-ink"
              >
                Terms
              </Link>
              <button
                type="button"
                onClick={scrollToTop}
                className="inline-flex min-h-11 items-center hover:text-ink"
              >
                Back to top
              </button>
            </div>
            <p className="text-xs">
              © {new Date().getFullYear()} Cadence. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
