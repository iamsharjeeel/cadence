"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { buttonStyles } from "@/components/ui/Button";

export function AsanaConnectBanner({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface px-4 py-3 shadow-sm"
    >
      <AsanaIcon size={22} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          Connect Asana to import your projects
        </p>
        <p className="mt-0.5 text-sm text-muted">
          Tag time entries with your Asana projects without changing Cadence
          projects.
        </p>
        <Link
          href="/app/profile#section-connected"
          className={buttonStyles("primary", "sm", "mt-3 inline-flex")}
        >
          Connected accounts
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--line)] hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
