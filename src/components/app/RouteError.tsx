"use client";

import { useEffect } from "react";

export function RouteError({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[${title}]`, error);
  }, [title, error]);

  return (
    <div className="rounded-[var(--radius)] border border-[var(--danger)]/30 bg-surface p-6">
      <h2 className="font-medium text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        {error.message || "Something went wrong rendering this page."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 text-sm font-medium text-[var(--accent-strong)] hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
