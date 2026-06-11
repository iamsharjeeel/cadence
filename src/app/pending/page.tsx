import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MeshBackground } from "@/components/auth/MeshBackground";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Wordmark } from "@/components/brand/Wordmark";
import { getProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Awaiting access",
};

export default async function PendingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  // Active users don't belong here.
  if (profile.status === "active") redirect("/app/dashboard");

  const suspended = profile.status === "suspended";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <MeshBackground />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[calc(var(--radius)+4px)] border bg-surface/80 p-8 text-center shadow-card backdrop-blur-xl">
          <div className="mb-6 flex justify-center">
            <Wordmark className="text-xl" />
          </div>

          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            {suspended ? <LockIcon /> : <ClockIcon />}
          </div>

          <h1 className="font-display text-xl font-semibold tracking-tightest">
            {suspended ? "Access suspended" : "Waiting for approval"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {suspended
              ? "Your access has been suspended. Please contact your organization's administrator if you believe this is a mistake."
              : "Your account is set up and waiting for an administrator to grant access. You'll be able to sign in to Cadence once approved."}
          </p>

          <p className="mt-4 text-xs text-muted">
            Signed in as <span className="text-ink">{profile.email}</span>
          </p>

          <div className="mt-8 flex justify-center">
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
