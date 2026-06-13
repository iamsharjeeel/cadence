"use client";

import { RouteError } from "@/components/app/RouteError";

export default function TimesheetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load timesheets" error={error} reset={reset} />
  );
}
