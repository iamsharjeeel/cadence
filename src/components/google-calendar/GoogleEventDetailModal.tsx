"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";

import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import { MotionModal } from "@/components/motion/MotionModal";
import { Button } from "@/components/ui/Button";
import type { GoogleCalendarEventWithMeta } from "@/lib/google-calendar/sync";
import { formatDate } from "@/lib/utils";
import { refreshEventDetails } from "@/app/app/profile/google-calendar-actions";

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildPrefillParam(event: GoogleCalendarEventWithMeta): string {
  const payload = {
    title: event.title ?? "Calendar event",
    start: event.start_at,
    end: event.end_at,
    date: event.start_at.slice(0, 10),
  };
  return encodeURIComponent(JSON.stringify(payload));
}

export function GoogleEventDetailModal({
  open,
  onClose,
  event,
  onEventUpdated,
}: {
  open: boolean;
  onClose: () => void;
  event: GoogleCalendarEventWithMeta | null;
  onEventUpdated?: (event: GoogleCalendarEventWithMeta) => void;
}) {
  const [current, setCurrent] = useState(event);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCurrent(event);
  }, [event]);

  if (!current) return null;

  const guests = Array.isArray(current.guests)
    ? (current.guests as Array<{
        email?: string;
        displayName?: string;
        responseStatus?: string;
      }>)
    : [];

  function handleRefresh() {
    if (!current) return;
    startTransition(async () => {
      const result = await refreshEventDetails(current.google_event_id);
      if (result.ok && result.event) {
        setCurrent(result.event);
        onEventUpdated?.(result.event);
      }
    });
  }

  return (
    <MotionModal open={open} onClose={onClose} panelClassName="max-w-lg">
      <div className="flex items-start gap-3">
        <GoogleCalendarIcon size={24} />
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            {current.title ?? "Untitled event"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {formatDate(current.start_at.slice(0, 10))} ·{" "}
            {formatEventTime(current.start_at)} – {formatEventTime(current.end_at)}
          </p>
        </div>
      </div>

      {current.description ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Description
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
            {current.description}
          </p>
        </div>
      ) : null}

      {current.location ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Location
          </p>
          <p className="mt-1 text-sm text-ink">{current.location}</p>
        </div>
      ) : null}

      {(current.organizer_name || current.organizer_email) && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Organizer
          </p>
          <p className="mt-1 text-sm text-ink">
            {current.organizer_name ?? current.organizer_email}
            {current.organizer_name && current.organizer_email ? (
              <span className="text-muted"> · {current.organizer_email}</span>
            ) : null}
          </p>
        </div>
      )}

      {guests.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Guests
          </p>
          <ul className="mt-2 space-y-1">
            {guests.map((guest, i) => (
              <li key={`${guest.email ?? i}`} className="text-sm text-ink">
                {guest.displayName ?? guest.email ?? "Guest"}
                {guest.responseStatus ? (
                  <span className="ml-2 text-xs capitalize text-muted">
                    {guest.responseStatus.replace("_", " ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 border-t border-line pt-4 text-sm">
        {current.calendar_name ? (
          <p className="text-muted">
            Calendar:{" "}
            <span className="text-ink">{current.calendar_name}</span>
          </p>
        ) : null}
        {current.html_link ? (
          <a
            href={current.html_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[#4285F4] hover:underline"
          >
            Open in Google Calendar
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={pending}
          onClick={handleRefresh}
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh details
        </Button>
        <Link
          href={`/app/timesheets/log?date=${current.start_at.slice(0, 10)}&prefill=${buildPrefillParam(current)}`}
          className="inline-flex"
        >
          <Button type="button" size="sm">
            Add as time entry
          </Button>
        </Link>
      </div>
    </MotionModal>
  );
}
