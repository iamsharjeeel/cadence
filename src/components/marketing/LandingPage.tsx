"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import gsap from "gsap";
import {
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Upload,
  UserCheck,
  Zap,
} from "lucide-react";

import { Wordmark } from "@/components/brand/Wordmark";
import { CountUp } from "@/components/motion/CountUp";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonStyles } from "@/components/ui/Button";
import { prefersReducedMotion } from "@/lib/motion";

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

function DashboardMockup() {
  return (
    <div
      className="relative hidden overflow-hidden rounded-[var(--radius)] border bg-surface shadow-card lg:block"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
        <span className="ml-2 text-xs text-muted">cadence — dashboard</span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        {["Pending", "Approved hrs", "Pay estimate"].map((label) => (
          <div
            key={label}
            className="rounded-xl border bg-[var(--accent-soft)]/30 p-3"
          >
            <p className="text-[10px] uppercase tracking-wide text-muted">
              {label}
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-ink">
              —
            </p>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-4 rounded-xl border">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted">
          Recent timesheets
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b px-3 py-2 last:border-0"
          >
            <span className="h-2 w-24 rounded bg-[var(--line)]" />
            <span className="h-5 w-16 rounded-full bg-[var(--accent-soft)]" />
          </div>
        ))}
      </div>
      <LayoutDashboard
        className="absolute -bottom-6 -right-6 h-32 w-32 text-[var(--accent-soft)]"
        strokeWidth={1}
      />
    </div>
  );
}

export function LandingPage() {
  const heroSectionRef = useRef<HTMLElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = heroContentRef.current;
    if (!el || hasAnimated.current) return;

    const targets = el.querySelectorAll("[data-hero-reveal]");
    if (targets.length === 0) return;

    if (prefersReducedMotion()) {
      hasAnimated.current = true;
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(targets, { opacity: 1, y: 0 });
    hasAnimated.current = true;
  }, []);

  function scrollToFeatures() {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <Wordmark />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className={buttonStyles("ghost", "sm")}>
              Sign in
            </Link>
            <Link href="/login" className={buttonStyles("primary", "sm")}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section
          ref={heroSectionRef}
          className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-20 pt-16 sm:px-8 sm:pt-24"
        >
          <HeroCanvas heroRef={heroSectionRef} />
          <div
            ref={heroContentRef}
            className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div>
              <p
                data-hero-reveal
                className="mb-5 inline-flex items-center gap-2 rounded-full border bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Premium timesheet portal
              </p>
              <h1
                data-hero-reveal
                className="font-display text-5xl font-semibold leading-[1.02] tracking-tightest sm:text-6xl lg:text-8xl"
              >
                Time, tracked with rhythm.
              </h1>
              <p
                data-hero-reveal
                className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl"
              >
                A premium timesheet portal for modern teams. Upload, approve, and
                pay — without the friction.
              </p>
              <div
                data-hero-reveal
                className="mt-10 flex flex-wrap items-center gap-3"
              >
                <Link href="/login" className={buttonStyles("primary", "md")}>
                  Get started
                </Link>
                <button
                  type="button"
                  onClick={scrollToFeatures}
                  className={buttonStyles("secondary", "md")}
                >
                  See how it works
                </button>
              </div>
            </div>
            <DashboardMockup />
          </div>
        </section>

        <section
          id="features"
          className="border-t bg-surface/50 px-6 py-20 sm:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold tracking-tightest sm:text-3xl">
              Built for teams who care about the details
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              Everything you need to move from raw hours to pay-ready documents
              — quietly, reliably.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="h-full rounded-[var(--radius)] border border-l-4 border-l-[var(--accent)] bg-surface p-6 shadow-card"
                >
                  <f.icon
                    className="mb-4 h-6 w-6 text-[var(--accent-strong)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <h3 className="font-medium text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-[var(--accent-soft)]/20 px-6 py-16 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-4xl font-semibold text-[var(--accent-strong)] sm:text-5xl">
                  <CountUp
                    value={s.value}
                    suffix={s.suffix}
                    decimals={0}
                    startOnView
                    duration={1}
                  />
                </p>
                <p className="mt-2 text-sm text-muted">{s.label}</p>
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
                  <span className="font-display text-5xl font-semibold text-[var(--accent)]">
                    {s.step}
                  </span>
                  <s.icon
                    className="h-8 w-8 text-[var(--accent-strong)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <h3 className="font-medium text-ink">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t px-6 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="flex h-full flex-col rounded-[var(--radius)] border bg-surface p-6 shadow-card"
                >
                  <p className="flex-1 text-sm leading-relaxed text-ink">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="mt-6 text-sm font-medium text-ink">{t.name}</p>
                  <p className="text-xs text-muted">{t.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-[var(--radius)] border bg-[var(--accent-soft)]/40 px-8 py-14 text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tightest sm:text-3xl">
                Ready to bring rhythm to your team?
              </h2>
              <div className="mt-8">
                <Link href="/login" className={buttonStyles("primary", "md")}>
                  Get started free
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 text-sm text-muted">
              Time, tracked with rhythm.
            </p>
            <p className="mt-1 text-xs text-muted">
              Quiet luxury for payroll teams.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-muted sm:items-end">
            <div className="flex flex-wrap gap-4">
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
              <button
                type="button"
                onClick={scrollToTop}
                className="hover:text-ink"
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
