"use client";

import { RouteError } from "@/components/app/RouteError";

export default function TimesheetDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load timesheet" error={error} reset={reset} />
  );
}
