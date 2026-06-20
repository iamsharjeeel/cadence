"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";

import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import { Button, buttonStyles } from "@/components/ui/Button";
import type { GCalConnectionStatus } from "@/lib/google-calendar/connection";
import type { GoogleCalendarEventWithMeta } from "@/lib/google-calendar/sync";
import { cn, formatDate } from "@/lib/utils";
import { InlineDisconnect } from "./InlineDisconnect";
import {
  disconnectGoogleCalendar,
  fetchUserCalendars,
  loadManageModalEvents,
  refreshEventDetails,
  syncAllEvents,
  upsertCalendarSyncState,
  type GCalCalendarOption,
} from "./google-calendar-actions";

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function maxSyncedAt(events: GoogleCalendarEventWithMeta[]): string | null {
  let max: string | null = null;
  for (const e of events) {
    if (e.synced_at && (!max || e.synced_at > max)) max = e.synced_at;
  }
  return max;
}

export function GoogleCalendarConnectionPanel({
  connection,
  onToast,
  onDisconnected,
}: {
  connection: GCalConnectionStatus;
  onToast: (message: string) => void;
  onDisconnected: () => void;
}) {
  const [calendars, setCalendars] = useState<GCalCalendarOption[]>([]);
  const [events, setEvents] = useState<GoogleCalendarEventWithMeta[]>([]);
  const [email, setEmail] = useState<string | null>(connection.googleEmail);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [syncPending, startSync] = useTransition();
  const [disconnectPending, startDisconnect] = useTransition();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const syncInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNeedsReconnect(false);

    Promise.all([fetchUserCalendars(), loadManageModalEvents()])
      .then(([calResult, eventResult]) => {
        if (cancelled) return;
        setLoading(false);

        if (!calResult.ok || !calResult.calendars) {
          setLoadError(calResult.message);
          setNeedsReconnect(Boolean(calResult.needsReconnect));
          setCalendars([]);
        } else {
          setCalendars(calResult.calendars);
          if (calResult.email) setEmail(calResult.email);
        }

        if (eventResult.ok && eventResult.events) {
          setEvents(eventResult.events);
          setLastSynced(maxSyncedAt(eventResult.events));
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleToggle(cal: GCalCalendarOption) {
    const next = !cal.isSynced;
    setCalendars((prev) =>
      prev.map((c) => (c.id === cal.id ? { ...c, isSynced: next } : c)),
    );

    startTransition(async () => {
      const result = await upsertCalendarSyncState(cal.id, cal.summary, next);
      if (!result.ok) {
        setCalendars((prev) =>
          prev.map((c) => (c.id === cal.id ? { ...c, isSynced: !next } : c)),
        );
        onToast(result.message);
        if (result.needsReconnect) setNeedsReconnect(true);
      }
    });
  }

  function handleSync() {
    if (syncInFlight.current || syncPending) return;
    syncInFlight.current = true;
    startSync(async () => {
      try {
        const result = await syncAllEvents();
        onToast(result.message);
        if (result.needsReconnect) {
          setNeedsReconnect(true);
          return;
        }
        if (result.ok) {
          const refreshed = await loadManageModalEvents();
          if (refreshed.ok && refreshed.events) {
            setEvents(refreshed.events);
            setLastSynced(maxSyncedAt(refreshed.events) ?? new Date().toISOString());
          }
        }
      } finally {
        syncInFlight.current = false;
      }
    });
  }

  function handleRefreshEvent(googleEventId: string) {
    setRefreshingId(googleEventId);
    startTransition(async () => {
      const result = await refreshEventDetails(googleEventId);
      if (result.ok && result.event) {
        setEvents((prev) =>
          prev.map((e) =>
            e.google_event_id === googleEventId ? result.event! : e,
          ),
        );
      } else {
        onToast(result.message);
        if (result.needsReconnect) setNeedsReconnect(true);
      }
      setRefreshingId(null);
    });
  }

  function handleDisconnect() {
    startDisconnect(async () => {
      const result = await disconnectGoogleCalendar();
      onToast(result.message);
      if (result.ok) onDisconnected();
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface-low p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-[#4285F4]/10">
          <GoogleCalendarIcon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink">
            Google Calendar
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            {email ?? "Connected account"}
          </p>
          {connection.connectedAt ? (
            <p className="text-xs text-muted">
              Connected{" "}
              {new Date(connection.connectedAt).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </p>
          ) : null}
        </div>
      </div>

      {needsReconnect ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          Your Google Calendar connection expired.
          <Link
            href="/api/google-calendar/connect"
            className={buttonStyles("primary", "sm")}
          >
            Reconnect Google Calendar
          </Link>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading calendars…
        </div>
      ) : loadError && !needsReconnect ? (
        <p className="mt-4 text-sm text-[var(--danger)]">{loadError}</p>
      ) : (
        <>
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium text-ink">Calendars to sync</h4>
                <p className="text-xs text-muted">
                  Toggle which calendars appear in Cadence.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={syncPending}
                  disabled={syncInFlight.current}
                  onClick={handleSync}
                >
                  Sync events
                </Button>
                {lastSynced ? (
                  <span className="text-[11px] text-muted">
                    Last synced{" "}
                    {new Date(lastSynced).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                ) : null}
              </div>
            </div>

            {calendars.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                No calendars found.
              </p>
            ) : (
              <ul className="max-h-40 divide-y divide-line overflow-y-auto rounded-[var(--radius-card)] border border-line">
                {calendars.map((cal) => (
                  <li
                    key={cal.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {cal.summary}
                        {cal.primary ? (
                          <span className="ml-2 text-xs text-muted">Primary</span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={cal.isSynced}
                      onClick={() => handleToggle(cal)}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        cal.isSynced ? "bg-[#4285F4]" : "bg-[var(--line)]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                          cal.isSynced ? "left-[22px]" : "left-0.5",
                        )}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <h4 className="text-sm font-medium text-ink">Upcoming events (7 days)</h4>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No synced events yet. Select calendars and sync events.
              </p>
            ) : (
              <ul className="mt-3 max-h-48 divide-y divide-line overflow-y-auto rounded-[var(--radius-card)] border border-line">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {event.title ?? "Untitled event"}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(event.start_at.slice(0, 10))} ·{" "}
                        {formatEventTime(event.start_at)} –{" "}
                        {formatEventTime(event.end_at)}
                      </p>
                      {event.calendar_name ? (
                        <p className="truncate text-xs text-muted">
                          {event.calendar_name}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={refreshingId === event.google_event_id}
                      onClick={() => handleRefreshEvent(event.google_event_id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <InlineDisconnect
          confirmText="Disconnect Google Calendar? Synced events will be removed."
          pending={disconnectPending}
          onConfirm={handleDisconnect}
        />
      </div>
    </div>
  );
}
