import type { Metadata } from "next";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { MeshBackground } from "@/components/auth/MeshBackground";
import { Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = {
  title: "Sign in",
};

const ERROR_COPY: Record<string, string> = {
  suspended:
    "Your access has been suspended. Contact your organization's manager if you believe this is a mistake.",
  oauth: "Google sign-in was cancelled or failed. Please try again.",
  exchange: "We couldn't complete sign-in. Please try again.",
  session: "Your session couldn't be established. Please try again.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const errorKey = searchParams?.error;
  const errorMessage = errorKey ? ERROR_COPY[errorKey] : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <MeshBackground />

      <div className="relative z-10 w-full max-w-sm">
        <div className="rounded-[var(--radius-card)] bg-surface/80 p-8 shadow-card backdrop-blur-xl">
          <div className="flex flex-col items-center gap-2 text-center">
            <Wordmark className="text-2xl" />
            <p className="text-sm text-muted">Time, tracked with rhythm.</p>
          </div>

          <div className="my-8 h-px bg-[var(--line)]" />

          {errorMessage ? (
            <p
              className="mb-6 rounded-[var(--radius-card)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm leading-relaxed text-red-700 dark:text-red-300"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <GoogleButton />

          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            Sign in with your Google account. Join a team using an invite link
            from your manager — new members are guided through onboarding.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} Cadence
        </p>
      </div>
    </main>
  );
}
