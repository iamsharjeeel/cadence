import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { buttonStyles } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b px-6 py-5 sm:px-10">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-16 sm:px-8">
        <h1 className="font-display text-3xl font-semibold tracking-tightest">
          Terms of Service
        </h1>
        <p className="mt-4 text-muted leading-relaxed">
          This is a placeholder terms of service for Cadence. A full agreement
          will be published before general availability.
        </p>
        <Link href="/" className={`${buttonStyles("ghost", "sm")} mt-8 inline-flex`}>
          Back to home
        </Link>
      </main>
    </div>
  );
}
