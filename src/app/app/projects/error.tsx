"use client";

import { RouteError } from "@/components/app/RouteError";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="Couldn't load projects" error={error} reset={reset} />;
}
