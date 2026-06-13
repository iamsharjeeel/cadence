"use client";

import { RouteError } from "@/components/app/RouteError";

export default function TimeLogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load the time log" error={error} reset={reset} />
  );
}
