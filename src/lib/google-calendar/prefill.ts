import type { GoogleCalendarEventWithMeta } from "@/lib/google-calendar/sync";

export type GoogleCalendarPrefill = {
  title: string;
  start: string;
  end: string;
  date: string;
};

export function decodeGoogleCalendarPrefill(
  raw: string | null | undefined,
): GoogleCalendarPrefill | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as GoogleCalendarPrefill;
    if (!parsed.date || !parsed.start || !parsed.end) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function googleEventToDraftTimes(event: GoogleCalendarEventWithMeta): {
  start_time: string;
  end_time: string;
  description: string;
} {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    description: event.title ?? "Calendar event",
  };
}

export function formatGoogleEventTimeRange(
  event: GoogleCalendarEventWithMeta,
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${fmt(event.start_at)} – ${fmt(event.end_at)}`;
}
