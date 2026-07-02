import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { buttonStyles } from "@/components/ui/buttonStyles";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-5 sm:px-10">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-16 sm:px-8">
        <h1 className="font-display text-3xl font-semibold tracking-tightest">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted">Last updated: July 2026</p>

        <div className="mt-8 space-y-8 text-muted leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Overview
            </h2>
            <p className="mt-3">
              Cadence is a time-tracking and timesheet platform. This policy
              describes what information Cadence collects, how it is used, and
              the choices available to you. Cadence operates the service and is
              referred to as &ldquo;Cadence,&rdquo; &ldquo;we,&rdquo; or
              &ldquo;us&rdquo; in this document.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              What we collect
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-ink">Account information</strong> — name,
                email address, and profile details you provide. Sign-in is via
                Google OAuth; we receive your Google account email and basic
                profile information from Google.
              </li>
              <li>
                <strong className="text-ink">Work and time data</strong> — time
                entries, timesheets, projects, leave requests, rates, and
                related metadata you log in the app.
              </li>
              <li>
                <strong className="text-ink">Payroll and documents</strong> —
                pay advices, contractor invoices, and uploaded documents
                generated or stored in your workspace.
              </li>
              <li>
                <strong className="text-ink">Banking and tax details</strong> —
                bank account name, account number, BSB/SWIFT, tax identifiers,
                and address used for invoicing. Sensitive banking fields are
                encrypted at rest.
              </li>
              <li>
                <strong className="text-ink">Organization data</strong> — org
                name, settings, memberships, invites, and audit log entries when
                you use or manage an organization workspace.
              </li>
              <li>
                <strong className="text-ink">Integration data</strong> — if you
                connect optional integrations, Cadence stores OAuth tokens
                (encrypted) and synced data such as Asana project names or
                Google Calendar events you choose to sync.
              </li>
              <li>
                <strong className="text-ink">Technical data</strong> — standard
                server logs, session cookies required for authentication, and
                usage data needed to operate and secure the service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              How we use your information
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Provide time tracking, timesheets, leave, and document features.</li>
              <li>Calculate earnings estimates and generate payroll documents.</li>
              <li>Send transactional email (e.g. document delivery) via Resend.</li>
              <li>Sync leave and calendar events when you connect Google Calendar.</li>
              <li>Enforce workspace isolation, role-based access, and audit logging.</li>
              <li>Maintain, secure, and improve the Cadence service.</li>
            </ul>
            <p className="mt-3">
              Cadence does not sell your personal information. We do not use your
              data for third-party advertising.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Storage and security
            </h2>
            <p className="mt-3">
              Data is stored in Supabase (PostgreSQL) with row-level security
              scoped to your workspace. Files (timesheets, PDFs, uploads) are
              stored in private Supabase Storage buckets and accessed via
              time-limited signed URLs. Banking fields are encrypted using a
              server-side encryption key. OAuth tokens for integrations are
              encrypted at rest.
            </p>
            <p className="mt-3">
              No system is perfectly secure. We apply industry-standard
              practices, but you should use a strong Google account and keep
              access credentials confidential.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Third-party services
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-ink">Supabase</strong> — database,
                authentication, and file storage.
              </li>
              <li>
                <strong className="text-ink">Google</strong> — OAuth sign-in and,
                if enabled, Google Calendar sync.
              </li>
              <li>
                <strong className="text-ink">Asana</strong> — optional project
                import when you connect your account.
              </li>
              <li>
                <strong className="text-ink">Resend</strong> — transactional email
                delivery.
              </li>
              <li>
                <strong className="text-ink">Vercel</strong> — application
                hosting.
              </li>
            </ul>
            <p className="mt-3">
              Each provider processes data according to its own privacy policy
              and only to the extent needed to deliver the integration you
              enable.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Data retention and deletion
            </h2>
            <p className="mt-3">
              We retain your data while your account is active and as needed to
              provide the service, comply with legal obligations, or resolve
              disputes. Organization owners may remove members; superadmin and
              audit records may be retained for platform integrity.
            </p>
            <p className="mt-3">
              To request account or data deletion, contact Cadence through the
              support channel listed on the Cadence website or app. We will
              verify your identity before processing deletion requests.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Your choices
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Update profile, rate, and banking details in your Profile settings.</li>
              <li>Disconnect Asana or Google Calendar integrations in Settings.</li>
              <li>Switch between personal and organization workspaces in the app.</li>
              <li>Export audit logs (where your role permits).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Changes to this policy
            </h2>
            <p className="mt-3">
              We may update this policy from time to time. The &ldquo;Last
              updated&rdquo; date at the top will change when we do. Continued
              use of Cadence after changes take effect constitutes acceptance of
              the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-tightest text-ink">
              Contact
            </h2>
            <p className="mt-3">
              Questions about this policy or your data may be directed to Cadence
              via the contact information published on the Cadence website.
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
