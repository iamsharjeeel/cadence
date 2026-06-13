"use client";

import { RouteError } from "@/components/app/RouteError";

export default function DocumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load documents" error={error} reset={reset} />
  );
}
