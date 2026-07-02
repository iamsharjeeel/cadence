"use client";

import { RouteError } from "@/components/app/RouteError";

export default function TimeTrackedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load time tracked" error={error} reset={reset} />
  );
}
