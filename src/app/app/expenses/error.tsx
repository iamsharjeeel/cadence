"use client";

import { RouteError } from "@/components/app/RouteError";

export default function ExpensesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="Couldn't load expenses" error={error} reset={reset} />;
}
