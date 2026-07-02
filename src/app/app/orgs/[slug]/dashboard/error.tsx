"use client";

import { RouteError } from "@/components/app/RouteError";

export default function OrgDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load org dashboard" error={error} reset={reset} />
  );
}
