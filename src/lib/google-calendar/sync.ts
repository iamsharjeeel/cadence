import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEvent, listEvents } from "@/lib/google-calendar/api";
import type { GoogleCalendarApiEvent } from "@/lib/google-calendar/api";

export type GoogleCalendarEventGuest = {
  email?: string;
  displayName?: string;
  responseStatus?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  user_id: string;
  google_event_id: string;
  calendar_id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  organizer_email: string | null;
  organizer_name: string | null;
  guests: GoogleCalendarEventGuest[];
  html_link: string | null;
  synced_at: string;
};

/** Client-facing event with resolved calendar display name. */
export type GoogleCalendarEventWithMeta = GoogleCalendarEvent & {
  calendar_name: string | null;
};

function parseEventTimes(event: GoogleCalendarApiEvent): {
  startAt: string;
  endAt: string;
} | null {
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;
  if (!startRaw || !endRaw) return null;

  const startAt = event.start?.dateTime
    ? new Date(startRaw).toISOString()
    : new Date(`${startRaw}T00:00:00.000Z`).toISOString();

  const endAt = event.end?.dateTime
    ? new Date(endRaw).toISOString()
    : new Date(`${endRaw}T00:00:00.000Z`).toISOString();

  return { startAt, endAt };
}

function mapApiEventToRow(
  userId: string,
  calendarId: string,
  calendarName: string,
  event: GoogleCalendarApiEvent,
) {
  const times = parseEventTimes(event);
  if (!times) return null;

  return {
    user_id: userId,
    google_event_id: event.id,
    calendar_id: calendarId,
    title: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    start_at: times.startAt,
    end_at: times.endAt,
    organizer_email: event.organizer?.email ?? null,
    organizer_name: event.organizer?.displayName ?? null,
    guests: (event.attendees ?? []) as GoogleCalendarEventGuest[],
    html_link: event.htmlLink ?? null,
    synced_at: new Date().toISOString(),
  };
}

export async function syncGCalEvents(userId: string): Promise<number> {
  const db = createAdminClient();

  const { data: calendars, error: calErr } = await db
    .from("google_selected_calendars")
    .select("calendar_id, calendar_name")
    .eq("user_id", userId)
    .eq("is_synced", true);

  if (calErr) {
    console.error("[gcal] selected calendars fetch failed:", calErr.message);
    throw new Error("Couldn't load selected calendars.");
  }

  if (!calendars?.length) {
    return 0;
  }

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - 7);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + 60);

  const timeMinIso = timeMin.toISOString();
  const timeMaxIso = timeMax.toISOString();

  let synced = 0;

  for (const cal of calendars) {
    const events = await listEvents(
      userId,
      cal.calendar_id,
      timeMinIso,
      timeMaxIso,
    );

    for (const event of events) {
      const row = mapApiEventToRow(
        userId,
        cal.calendar_id,
        cal.calendar_name,
        event,
      );
      if (!row) continue;

      const { error } = await db.from("google_calendar_events").upsert(row, {
        onConflict: "user_id,google_event_id",
      });

      if (!error) synced += 1;
    }
  }

  return synced;
}

export async function getEventsForDay(
  userId: string,
  date: string,
): Promise<GoogleCalendarEventWithMeta[]> {
  const db = createAdminClient();
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data, error } = await db
    .from("google_calendar_events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", dayStart)
    .lte("start_at", dayEnd)
    .order("start_at");

  if (error) {
    console.error("[gcal] getEventsForDay failed:", error.message);
    return [];
  }

  return attachCalendarNames(userId, (data ?? []) as GoogleCalendarEvent[]);
}

export async function getEventsForDateRange(
  userId: string,
  from: string,
  to: string,
): Promise<GoogleCalendarEventWithMeta[]> {
  const db = createAdminClient();
  const rangeStart = `${from}T00:00:00.000Z`;
  const rangeEnd = `${to}T23:59:59.999Z`;

  const { data, error } = await db
    .from("google_calendar_events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", rangeStart)
    .lte("start_at", rangeEnd)
    .order("start_at");

  if (error) {
    console.error("[gcal] getEventsForDateRange failed:", error.message);
    return [];
  }

  return attachCalendarNames(userId, (data ?? []) as GoogleCalendarEvent[]);
}

export async function refreshSingleEvent(
  userId: string,
  googleEventId: string,
): Promise<GoogleCalendarEventWithMeta | null> {
  const db = createAdminClient();

  const { data: existing, error: fetchErr } = await db
    .from("google_calendar_events")
    .select("*")
    .eq("user_id", userId)
    .eq("google_event_id", googleEventId)
    .maybeSingle();

  if (fetchErr || !existing) {
    console.error("[gcal] refresh event lookup failed:", fetchErr?.message);
    return null;
  }

  const row = existing as GoogleCalendarEvent;
  const apiEvent = await getEvent(userId, row.calendar_id, googleEventId);
  const { data: calRow } = await db
    .from("google_selected_calendars")
    .select("calendar_name")
    .eq("user_id", userId)
    .eq("calendar_id", row.calendar_id)
    .maybeSingle();

  const mapped = mapApiEventToRow(
    userId,
    row.calendar_id,
    calRow?.calendar_name ?? row.calendar_id,
    apiEvent,
  );

  if (!mapped) return null;

  const { data: updated, error } = await db
    .from("google_calendar_events")
    .update({
      ...mapped,
      synced_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("google_event_id", googleEventId)
    .select("*")
    .single();

  if (error) {
    console.error("[gcal] refresh event update failed:", error.message);
    return null;
  }

  const enriched = await attachCalendarNames(userId, [
    updated as GoogleCalendarEvent,
  ]);
  return enriched[0] ?? null;
}

export async function getUpcomingSyncedEvents(
  userId: string,
  days = 7,
  limit = 20,
): Promise<GoogleCalendarEventWithMeta[]> {
  const db = createAdminClient();
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  const { data, error } = await db
    .from("google_calendar_events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", now.toISOString())
    .lte("start_at", end.toISOString())
    .order("start_at")
    .limit(limit);

  if (error) {
    console.error("[gcal] upcoming events failed:", error.message);
    return [];
  }

  return attachCalendarNames(userId, (data ?? []) as GoogleCalendarEvent[]);
}

async function attachCalendarNames(
  userId: string,
  events: GoogleCalendarEvent[],
): Promise<GoogleCalendarEventWithMeta[]> {
  if (!events.length) return [];

  const db = createAdminClient();
  const { data: calendars } = await db
    .from("google_selected_calendars")
    .select("calendar_id, calendar_name")
    .eq("user_id", userId);

  const nameById = new Map(
    (calendars ?? []).map((c) => [c.calendar_id, c.calendar_name]),
  );

  return events.map((e) => ({
    ...e,
    calendar_name: nameById.get(e.calendar_id) ?? null,
  }));
}

export async function hasSyncedCalendars(userId: string): Promise<boolean> {
  const db = createAdminClient();
  const { count, error } = await db
    .from("google_selected_calendars")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_synced", true);

  if (error) return false;
  return (count ?? 0) > 0;
}
