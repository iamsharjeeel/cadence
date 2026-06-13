"use client";

import { RouteError } from "@/components/app/RouteError";

export default function LeaveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="Couldn't load leave" error={error} reset={reset} />;
}
