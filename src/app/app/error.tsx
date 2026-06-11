"use client";

import { RouteError } from "@/components/app/RouteError";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      title="Something went wrong"
      error={error}
      reset={reset}
    />
  );
}
