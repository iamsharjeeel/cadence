"use client";

import { RouteError } from "@/components/app/RouteError";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError title="Couldn't load your profile" error={error} reset={reset} />
  );
}
