"use client";

import { RouteError } from "@/components/app/RouteError";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      title="Couldn't load settings"
      error={error}
      reset={reset}
    />
  );
}
