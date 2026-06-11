"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import gsap from "gsap";

import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonStyles } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  DURATION,
  EASE,
  RISE,
  enablePointerEvents,
  prefersReducedMotion,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

const HeroCanvas = dynamic(
  () => import("./HeroCanvas").then((m) => m.HeroCanvas),
  { ssr: false },
);

const FEATURES = [
  {
    title: "Three ways to submit",
    description:
      "Drag and drop, paste from Excel, or link a Google Sheet. One smart pipeline handles all three.",
  },
  {
    title: "Approval without the back-and-forth",
    description:
      "Admins approve in one click. Rate and currency locked at approval. Full audit trail.",
  },
  {
    title: "Pay-ready documents",
    description:
      "Generate a pay advice or contractor invoice from any approved timesheet. Formal enough for accounts payable.",
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Employee uploads timesheet",
    description: "Smart header mapping handles any format.",
  },
  {
    step: "2",
    title: "Admin reviews and approves",
    description: "Rate snapshot locked, total calculated.",
  },
  {
    step: "3",
    title: "Document generated and emailed",
    description: "Ready for accounts payable.",
  },
] as const;

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
      enablePointerEvents(Array.from(targets));
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y: RISE,
        duration: DURATION,
        ease: EASE,
        stagger: 0.08,
        clearProps: "transform,opacity",
        onComplete: () => {
          hasAnimated.current = true;
        },
      });
    }, el);

    return () => {
      if (!hasAnimated.current) ctx.revert();
      else ctx.kill();
    };
  }, []);

  function scrollToFeatures() {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 sm:px-8">
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
          className="relative mx-auto max-w-5xl overflow-hidden px-6 pb-20 pt-16 sm:px-8 sm:pt-24"
        >
          <HeroCanvas heroRef={heroSectionRef} />
          <div ref={heroContentRef} className="relative z-10 max-w-3xl">
            <p
              data-hero-reveal
              className="mb-5 inline-flex items-center gap-2 rounded-full border bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Premium timesheet portal
            </p>
            <h1
              data-hero-reveal
              className="font-display text-4xl font-semibold leading-[1.05] tracking-tightest sm:text-6xl lg:text-7xl"
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
        </section>

        <section
          id="features"
          className="border-t bg-surface/50 px-6 py-20 sm:px-8"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-2xl font-semibold tracking-tightest sm:text-3xl">
              Built for teams who care about the details
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              Everything you need to move from raw hours to pay-ready documents
              — quietly, reliably.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title} className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm leading-relaxed">
                      {f.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-2xl font-semibold tracking-tightest sm:text-3xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.step} className="relative flex flex-col gap-3">
                  {i < STEPS.length - 1 && (
                    <span
                      className="absolute left-5 top-10 hidden h-px w-[calc(100%+2rem)] bg-line sm:block"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border bg-surface",
                      "font-display text-sm font-semibold text-[var(--accent-strong)]",
                    )}
                  >
                    {s.step}
                  </span>
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
          <div className="mx-auto max-w-5xl">
            <Card className="mx-auto max-w-2xl">
              <CardContent className="py-10 text-center">
                <p className="text-lg leading-relaxed text-ink">
                  &ldquo;Cadence replaced our spreadsheet chaos with something
                  we actually trust. Approvals take seconds, and finance gets
                  clean documents every time.&rdquo;
                </p>
                <p className="mt-6 text-sm font-medium text-ink">
                  Alex Morgan
                </p>
                <p className="text-xs text-muted">
                  Operations Lead · Placeholder testimonial
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="px-6 pb-20 sm:px-8">
          <div className="mx-auto max-w-5xl">
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
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 text-sm text-muted">
              Time, tracked with rhythm.
            </p>
            <p className="mt-1 text-xs text-muted">
              Built with Anthropic Claude.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-muted sm:items-end">
            <div className="flex gap-4">
              <span className="cursor-default">Privacy</span>
              <span className="cursor-default">Terms</span>
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
