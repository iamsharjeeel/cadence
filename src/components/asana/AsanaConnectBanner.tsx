"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import { buttonStyles } from "@/components/ui/Button";

export function AsanaConnectBanner({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface px-3 py-2.5 shadow-sm"
    >
      <div className="mt-0.5 flex items-center gap-1.5">
        <AsanaIcon size={18} />
        <GoogleCalendarIcon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          Connect Asana and Google Calendar
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Link accounts for project tagging, leave sync visibility, and calendar
          suggestions.
        </p>
        <Link
        href="/app/user-settings#section-connected"
          className={buttonStyles("primary", "sm", "mt-2 inline-flex")}
        >
          Connect accounts
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
