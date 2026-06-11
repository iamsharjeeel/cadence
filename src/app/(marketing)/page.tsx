import Link from "next/link";

import { MeshBackground } from "@/components/auth/MeshBackground";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function MarketingPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <MeshBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Wordmark />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <Button size="sm" variant="ghost">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center px-6 sm:px-10">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-surface/60 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Premium timesheet portal
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tightest sm:text-6xl">
            Time, tracked with rhythm.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Cadence is a quiet, considered home for submitting and approving
            timesheets — built for teams who care about the details.
          </p>
          <div className="mt-9 flex justify-center">
            <Link href="/login">
              <Button size="md">Continue with Google</Button>
            </Link>
          </div>
        </div>
      </div>

      <footer className="relative z-10 px-6 py-6 text-center text-xs text-muted sm:px-10">
        © {new Date().getFullYear()} Cadence · A full landing experience
        arrives in a later phase.
      </footer>
    </main>
  );
}
