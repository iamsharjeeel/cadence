"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Upload,
  UserCheck,
  UserPlus,
  Zap,
} from "lucide-react";

import { Wordmark } from "@/components/brand/Wordmark";
import { LandingCountUp } from "@/components/motion/LandingCountUp";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonStyles } from "@/components/ui/buttonStyles";

const HeroCanvas = dynamic(
  () => import("./HeroCanvas").then((m) => m.HeroCanvas),
  { ssr: false },
);

const FEATURES = [
  {
    icon: Upload,
    title: "Three ways to submit",
    description:
      "Drag and drop a spreadsheet, paste from Excel, or paste a public Google Sheets link. One intelligent pipeline normalizes headers, skips metadata rows, and validates every entry before submit.",
  },
  {
    icon: CheckCircle2,
    title: "Approval without the back-and-forth",
    description:
      "Managers approve in one click with rate and currency locked at approval time. Rejection notes, bulk approve, and a full audit trail keep everyone aligned.",
  },
  {
    icon: FileText,
    title: "Pay-ready documents",
    description:
      "Generate a pay advice or contractor invoice from any approved timesheet. PDFs are stored securely, emailed automatically, and ready for accounts payable.",
  },
  {
    icon: UserPlus,
    title: "Leave & onboarding",
    description:
      "Manage leave balances, approve requests, and onboard new employees with a guided wizard — all in one portal.",
  },
] as const;

const INTEGRATIONS = [
  "Google Sheets",
  "Xero",
  "Slack",
  "Gmail",
  "QuickBooks",
] as const;

const STATS = [
  { value: 3, suffix: "", label: "upload methods" },
  { value: 100, suffix: "%", label: "server-validated" },
  { value: 1, suffix: "", label: "click to pay-ready" },
] as const;

const STEPS = [
  {
    step: "1",
    icon: Upload,
    title: "Employee uploads timesheet",
    description: "Smart header mapping handles any format.",
  },
  {
    step: "2",
    icon: UserCheck,
    title: "Admin reviews and approves",
    description: "Rate snapshot locked, total calculated server-side.",
  },
  {
    step: "3",
    icon: Zap,
    title: "Document generated and emailed",
    description: "Pay advice or invoice — ready for finance.",
  },
] as const;

const TESTIMONIALS = [
  {
    quote:
      "Cadence replaced our spreadsheet chaos with something we actually trust. Approvals take seconds.",
    name: "Alex Morgan",
    role: "Operations Lead",
  },
  {
    quote:
      "Our contractors upload from Google Sheets and finance gets clean invoices the same day. No more chasing.",
    name: "Priya Shah",
    role: "Finance Manager",
  },
  {
    quote:
      "Leave balances, onboarding, and timesheets in one place — finally a portal that feels premium.",
    name: "James Okonkwo",
    role: "People & Culture",
  },
] as const;

const HEADLINE = ["Log", "time.", "Approve", "once.", "Get", "paid."];

function DashboardMockup() {
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: FileText, label: "Timesheets" },
    { icon: CalendarDays, label: "Leave" },
  ];

  return (
    <div
      className="relative hidden overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card lg:block"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <span className="ml-2 font-body text-xs text-muted">cadence — dashboard</span>
      </div>

      <div className="flex">
        <div className="w-28 shrink-0 border-r border-[var(--line)] bg-surface-low p-2">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={`mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px] ${
                item.active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-muted"
              }`}
            >
              <item.icon className="h-3 w-3" strokeWidth={1.75} />
              {item.label}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
            <span className="font-display text-[10px] font-medium text-ink">Dashboard</span>
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-[var(--accent-soft)]" />
              <span className="font-body text-[9px] text-muted">Alex</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3">
            {[
              { label: "Pending", value: "3" },
              { label: "Approved hrs", value: "142" },
              { label: "Pay estimate", value: "$8.4k" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-surface-low p-2"
              >
                <p className="font-body text-[8px] uppercase tracking-wide text-muted">
                  {stat.label}
                </p>
                <p className="mt-0.5 font-display text-sm font-bold tabular text-ink">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mx-3 mb-3 rounded-lg bg-surface-low">
            <div className="border-b border-[var(--line)] px-2 py-1.5 font-body text-[9px] font-medium text-muted">
              Recent timesheets
            </div>
            {["Sarah · Approved", "James · Submitted", "Priya · Approved"].map(
              (row) => (
                <div
                  key={row}
                  className="flex items-center justify-between border-b border-[var(--line)] px-2 py-1.5 last:border-0"
                >
                  <span className="font-body text-[9px] text-ink">{row.split(" · ")[0]}</span>
                  <span className="rounded-[var(--radius-chip)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-body text-[8px] text-[var(--accent)]">
                    {row.split(" · ")[1]}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent"
        aria-hidden
      />
    </div>
  );
}

export function LandingPage() {
  const heroSectionRef = useRef<HTMLElement>(null);

  function scrollToFeatures() {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-body">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-background/80 backdrop-blur-md">
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
        <section
          ref={heroSectionRef}
          className="relative mx-auto max-w-6xl overflow-hidden bg-background px-6 pb-20 pt-16 sm:px-8 sm:pt-24"
        >
          <HeroCanvas heroRef={heroSectionRef} />
          <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative">
              <p
                className="pointer-events-none absolute -left-2 top-0 z-0 max-w-none select-none font-playfair text-[96px] font-semibold italic leading-none tracking-tight text-ink opacity-10 sm:-left-4"
                aria-hidden
              >
                Time, tracked with rhythm.
              </p>
              <div className="relative z-10 pt-4">
                <p className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--line)] bg-surface/80 px-3 py-1 font-body text-xs font-medium text-muted backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Premium timesheet portal
                </p>
                <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[72px]">
                  {HEADLINE.map((word, i) => (
                    <motion.span
                      key={`${word}-${i}`}
                      className="mr-[0.25em] inline-block"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: i * 0.04,
                        ease: "easeOut",
                      }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </h1>
                <p className="mt-6 max-w-xl font-body text-xl leading-relaxed text-muted">
                  A premium timesheet portal for modern teams. Upload, approve, and
                  pay — without the friction.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <Link
                    href="/login"
                    className={`${buttonStyles("primary", "md")} min-h-11`}
                  >
                    Get started
                  </Link>
                  <button
                    type="button"
                    onClick={scrollToFeatures}
                    className={`${buttonStyles("secondary", "md")} min-h-11`}
                  >
                    See how it works
                  </button>
                </div>
              </div>
            </div>
            <DashboardMockup />
          </div>
        </section>

        <section className="border-y border-[var(--line)] bg-surface/30 px-6 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <p className="font-body text-xs font-medium uppercase tracking-widest text-muted">
              Built for teams running on
            </p>
            <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-body text-xs uppercase tracking-wider text-muted/80 sm:gap-x-6 sm:text-sm">
              {INTEGRATIONS.map((name, i) => (
                <span key={name}>
                  {name}
                  {i < INTEGRATIONS.length - 1 && (
                    <span className="ml-4 hidden text-muted/40 sm:inline">·</span>
                  )}
                </span>
              ))}
            </p>
          </div>
        </section>

        <section
          id="features"
          className="border-t border-[var(--line)] bg-background px-6 py-20 sm:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold tracking-tightest sm:text-3xl">
              Built for teams who care about the details
            </h2>
            <p className="mt-3 max-w-xl font-body text-muted">
              Everything you need to move from raw hours to pay-ready documents
              — quietly, reliably.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.2, delay: i * 0.05, ease: "easeOut" }}
                  className="h-full rounded-[var(--radius-card)] border-l-[3px] border-l-[var(--accent-mid)] bg-surface p-6 shadow-card"
                >
                  <f.icon
                    className="mb-4 h-6 w-6 text-[var(--accent)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <h3 className="font-display font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                    {f.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--line)] bg-surface-low px-6 py-16 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-[48px] font-bold tabular text-[var(--accent-mid)]">
                  <LandingCountUp
                    value={s.value}
                    suffix={s.suffix}
                    duration={1}
                  />
                </p>
                <p className="mt-2 font-body text-sm text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold tracking-tightest sm:text-3xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.step} className="flex flex-col gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)] font-display text-2xl font-bold text-[var(--accent)]">
                    {s.step}
                  </span>
                  <s.icon
                    className="h-8 w-8 text-[var(--accent)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <h3 className="font-display font-semibold text-ink">{s.title}</h3>
                  <p className="font-body text-sm leading-relaxed text-muted">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--line)] px-6 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="flex h-full flex-col rounded-[var(--radius-card)] bg-surface p-6 shadow-card"
                >
                  <p className="flex-1 font-body text-sm leading-relaxed text-ink">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="mt-6 font-body text-sm font-medium text-ink">{t.name}</p>
                  <p className="font-body text-xs text-muted">{t.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-[var(--radius-card)] bg-[var(--accent-soft)] px-6 py-14 text-center sm:px-8">
              <h2 className="font-display text-2xl font-semibold tracking-tightest sm:text-3xl">
                Ready to bring rhythm to your team?
              </h2>
              <div className="mt-8">
                <Link
                  href="/login"
                  className={`${buttonStyles("primary", "md")} inline-flex min-h-11 items-center`}
                >
                  Get started free
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-surface-low px-6 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 font-body text-sm text-muted">
              Time, tracked with rhythm.
            </p>
            <p className="mt-1 font-body text-xs text-muted">
              Quiet luxury for payroll teams.
            </p>
          </div>
          <div className="flex flex-col gap-2 font-body text-sm text-muted sm:items-end">
            <div className="flex flex-wrap gap-4">
              <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-ink">
                Privacy
              </Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-ink">
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
