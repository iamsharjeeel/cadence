"use client";

import { RouteError } from "@/components/app/RouteError";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load the dashboard" error={error} reset={reset} />
  );
}
