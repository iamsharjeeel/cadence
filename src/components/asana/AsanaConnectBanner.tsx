"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import { buttonStyles } from "@/components/ui/Button";

type ConnectBannerProps = {
  asanaConnected: boolean;
  gcalConnected: boolean;
};

export function AsanaConnectBanner({
  asanaConnected,
  gcalConnected,
}: ConnectBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const needsAsana = !asanaConnected;
  const needsGcal = !gcalConnected;
  const show = (needsAsana || needsGcal) && !dismissed;

  if (!show) return null;

  let heading = "";
  if (needsAsana && needsGcal) {
    heading =
      "Connect Asana and Google Calendar for a smoother workflow";
  } else if (needsAsana) {
    heading = "Connect Asana to import your projects for time entry tagging";
  } else {
    heading = "Connect Google Calendar to sync events with your leave calendar";
  }

  return (
    <div
      role="status"
      className="mb-5 flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface px-4 py-2.5 shadow-sm"
    >
      <div className="flex shrink-0 items-center gap-1.5">
        {needsAsana && <AsanaIcon size={18} />}
        {needsGcal && <GoogleCalendarIcon size={18} />}
      </div>

      <p className="min-w-0 flex-1 truncate text-sm text-ink">{heading}</p>

      <Link
        href="/app/user-settings#section-connected"
        className={buttonStyles("primary", "sm", "shrink-0")}
      >
        Connect accounts
      </Link>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--line)] hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
