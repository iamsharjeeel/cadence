import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { buttonStyles } from "@/components/ui/buttonStyles";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-5 sm:px-10">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-16 sm:px-8">
        <h1 className="font-display text-3xl font-semibold tracking-tightest">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted">Last updated: July 2026</p>

        <div className="mt-8 space-y-8 text-muted leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Agreement
            </h2>
            <p className="mt-3">
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to
              and use of Cadence, a time-tracking and timesheet platform
              operated by Cadence (&ldquo;Cadence,&rdquo; &ldquo;we,&rdquo; or
              &ldquo;us&rdquo;). By creating an account or using the service,
              you agree to these Terms. If you do not agree, do not use Cadence.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              The service
            </h2>
            <p className="mt-3">
              Cadence provides time tracking, timesheet submission and approval,
              leave management, payroll document generation, employee onboarding,
              and related workspace features. Features may differ between
              personal and organization workspaces. Cadence may add, change, or
              remove features over time.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Accounts
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                You must sign in with Google OAuth using an account you are
                authorized to use.
              </li>
              <li>
                You are responsible for activity under your account and for
                keeping your Google credentials secure.
              </li>
              <li>
                Organization access is invite-only. Joining an organization
                requires accepting an invite from an authorized owner or
                manager.
              </li>
              <li>
                You must provide accurate profile and employment information
                where requested.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Acceptable use
            </h2>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Use Cadence for unlawful purposes or in violation of applicable laws.</li>
              <li>Attempt to access data or workspaces you are not authorized to view.</li>
              <li>Interfere with or disrupt the service, including bypassing security controls.</li>
              <li>Upload malware, abusive content, or material that infringes others&apos; rights.</li>
              <li>Scrape, reverse engineer, or resell the service without permission.</li>
              <li>Misrepresent time entries, leave, or payroll data with intent to defraud.</li>
            </ul>
            <p className="mt-3">
              Organization owners and managers are responsible for how their
              members use the org workspace and for compliance with employment
              and payroll laws applicable to their organization.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Your content and data
            </h2>
            <p className="mt-3">
              You retain ownership of the time entries, documents, and other
              content you submit. You grant Cadence a limited license to host,
              process, and display that content solely to operate the service
              (including generating PDFs, sending email, and syncing
              integrations you enable).
            </p>
            <p className="mt-3">
              Cadence&apos;s handling of personal data is described in the{" "}
              <Link href="/privacy" className="text-[var(--accent-strong)] hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Integrations
            </h2>
            <p className="mt-3">
              Optional integrations (e.g. Asana, Google Calendar) are provided
              as-is. Cadence is not responsible for third-party service
              availability, accuracy, or policy changes. You may disconnect
              integrations at any time in Settings.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Service availability
            </h2>
            <p className="mt-3">
              Cadence is provided on a best-effort basis. We do not guarantee
              uninterrupted or error-free operation. Scheduled maintenance,
              third-party outages, or force majeure may affect availability. We
              may suspend access for security, abuse, or legal reasons.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Disclaimers
            </h2>
            <p className="mt-3">
              Cadence provides tools for time tracking and payroll document
              preparation. It is not legal, tax, or accounting advice. Earnings
              estimates, calculated totals, and generated documents should be
              reviewed by you or your organization before reliance. Cadence does
              not guarantee accuracy of rates, tax treatment, or compliance with
              local employment law.
            </p>
            <p className="mt-3">
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Limitation of liability
            </h2>
            <p className="mt-3">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CADENCE WILL NOT BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
              DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL, ARISING FROM
              YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING
              TO THE SERVICE IS LIMITED TO THE GREATER OF (A) AMOUNTS YOU PAID
              CADENCE FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM, OR
              (B) ONE HUNDRED US DOLLARS (USD $100), IF YOU HAVE NOT PAID FOR
              THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Termination
            </h2>
            <p className="mt-3">
              You may stop using Cadence at any time. Cadence may suspend or
              terminate your access if you breach these Terms or if required for
              legal or security reasons. Organization owners may remove members
              from their workspace. Provisions that by nature should survive
              termination (including disclaimers, limitation of liability, and
              governing law) will survive.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Changes to these Terms
            </h2>
            <p className="mt-3">
              We may update these Terms from time to time. The &ldquo;Last
              updated&rdquo; date will reflect changes. Material updates may be
              communicated through the app or website. Continued use after
              changes take effect constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Contact
            </h2>
            <p className="mt-3">
              Questions about these Terms may be directed to Cadence via the
              contact information published on the Cadence website.
            </p>
          </section>
        </div>

        <Link href="/" className={`${buttonStyles("ghost", "sm")} mt-10 inline-flex`}>
          Back to home
        </Link>
      </main>
    </div>
  );
}
