"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Unplug } from "lucide-react";

import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import { MotionModal } from "@/components/motion/MotionModal";
import { Button, buttonStyles } from "@/components/ui/Button";
import type { GCalConnectionStatus } from "@/lib/google-calendar/connection";
import type { GoogleCalendarEventWithMeta } from "@/lib/google-calendar/sync";
import { cn, formatDate } from "@/lib/utils";
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

export function GoogleCalendarManageModal({
  open,
  onClose,
  connection,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  connection: GCalConnectionStatus;
  onToast: (message: string) => void;
}) {
  const [calendars, setCalendars] = useState<GCalCalendarOption[]>([]);
  const [events, setEvents] = useState<GoogleCalendarEventWithMeta[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [syncPending, startSync] = useTransition();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setLoadError(null);
    setNeedsReconnect(false);

    Promise.all([fetchUserCalendars(), loadManageModalEvents()]).then(
      ([calResult, eventResult]) => {
        setLoading(false);

        if (!calResult.ok || !calResult.calendars) {
          setLoadError(calResult.message);
          setNeedsReconnect(Boolean(calResult.needsReconnect));
          setCalendars([]);
        } else {
          setCalendars(calResult.calendars);
        }

        if (eventResult.ok && eventResult.events) {
          setEvents(eventResult.events);
        }
      },
    );
  }, [open]);

  function handleToggle(cal: GCalCalendarOption) {
    const next = !cal.isSynced;
    setCalendars((prev) =>
      prev.map((c) => (c.id === cal.id ? { ...c, isSynced: next } : c)),
    );

    startTransition(async () => {
      const result = await upsertCalendarSyncState(cal.id, cal.summary, next);
      if (!result.ok) {
        setCalendars((prev) =>
          prev.map((c) =>
            c.id === cal.id ? { ...c, isSynced: !next } : c,
          ),
        );
        onToast(result.message);
        if (result.needsReconnect) setNeedsReconnect(true);
      }
    });
  }

  function handleSync() {
    startSync(async () => {
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
        }
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
    startTransition(async () => {
      const result = await disconnectGoogleCalendar();
      onToast(result.message);
      if (result.ok) {
        setDisconnectOpen(false);
        onClose();
      }
    });
  }

  return (
    <>
      <MotionModal open={open} onClose={onClose} panelClassName="max-w-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#4285F4]/10">
            <GoogleCalendarIcon size={22} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Google Calendar
            </h2>
            {connection.googleEmail ? (
              <p className="mt-1 text-sm text-muted">{connection.googleEmail}</p>
            ) : null}
            {connection.connectedAt ? (
              <p className="mt-1 text-xs text-muted">
                Connected{" "}
                {new Date(connection.connectedAt).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </p>
            ) : null}
          </div>
        </div>

        {needsReconnect ? (
          <div className="mt-4 rounded-[12px] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
            Your Google Calendar connection expired.
            <Link
              href="/api/google-calendar/connect"
              className={`${buttonStyles("primary", "sm")} mt-3`}
            >
              Reconnect Google Calendar
            </Link>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading calendars…
          </div>
        ) : loadError ? (
          <p className="mt-4 text-sm text-[var(--danger)]">{loadError}</p>
        ) : (
          <>
            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-ink">Calendars to sync</h3>
                  <p className="text-xs text-muted">
                    Toggle which calendars appear in Cadence.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={syncPending}
                  onClick={handleSync}
                >
                  Sync events
                </Button>
              </div>

              <ul className="max-h-40 divide-y divide-line overflow-y-auto rounded-[12px] border border-line">
                {calendars.map((cal) => (
                  <li
                    key={cal.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
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
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-medium text-ink">Upcoming events (7 days)</h3>
              {events.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  No synced events yet. Select calendars and sync events.
                </p>
              ) : (
                <ul className="mt-3 max-h-52 divide-y divide-line overflow-y-auto rounded-[12px] border border-line">
                  {events.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start justify-between gap-3 px-4 py-3"
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

        <div className="mt-6 flex justify-end border-t border-line pt-5">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setDisconnectOpen(true)}
          >
            <Unplug className="mr-1.5 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </MotionModal>

      <MotionModal
        open={disconnectOpen}
        onClose={() => !pending && setDisconnectOpen(false)}
        panelClassName="max-w-md"
      >
        <h2 className="font-display text-lg font-semibold text-ink">
          Disconnect Google Calendar?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Stored tokens will be revoked. Synced events and calendar selections will
          be removed — you can reconnect anytime.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setDisconnectOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={pending}
            onClick={handleDisconnect}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Disconnecting…
              </>
            ) : (
              "Disconnect"
            )}
          </Button>
        </div>
      </MotionModal>
    </>
  );
}
