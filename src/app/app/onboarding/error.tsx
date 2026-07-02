"use client";

import { RouteError } from "@/components/app/RouteError";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load onboarding" error={error} reset={reset} />
  );
}
