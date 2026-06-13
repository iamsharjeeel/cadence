"use client";

import { RouteError } from "@/components/app/RouteError";

export default function EmployeesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="Couldn't load the team" error={error} reset={reset} />;
}
