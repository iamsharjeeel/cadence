import type { Metadata } from "next";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { MeshBackground } from "@/components/auth/MeshBackground";
import { Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <MeshBackground />

      <div className="relative z-10 w-full max-w-sm">
        <div className="rounded-[calc(var(--radius)+4px)] border bg-surface/80 p-8 shadow-card backdrop-blur-xl">
          <div className="flex flex-col items-center gap-2 text-center">
            <Wordmark className="text-2xl" />
            <p className="text-sm text-muted">Time, tracked with rhythm.</p>
          </div>

          <div className="my-8 h-px bg-[var(--line)]" />

          <GoogleButton />

          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            Sign in with your organization&rsquo;s Google account. New members
            land in a holding area until an admin grants access.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} Cadence
        </p>
      </div>
    </main>
  );
}
