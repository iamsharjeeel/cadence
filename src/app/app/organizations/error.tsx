"use client";

import { RouteError } from "@/components/app/RouteError";

export default function OrganizationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load organizations" error={error} reset={reset} />
  );
}
