"use client";

import { RouteError } from "@/components/app/RouteError";

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="Couldn't load reports" error={error} reset={reset} />;
}
