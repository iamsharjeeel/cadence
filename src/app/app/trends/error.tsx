"use client";

import { RouteError } from "@/components/app/RouteError";

export default function TrendsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="Couldn't load trends" error={error} reset={reset} />;
}
