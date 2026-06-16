import "server-only";

import {
  GOOGLE_CALENDAR_API_BASE,
} from "@/lib/google-calendar/config";
import { getValidGCalAccessToken } from "@/lib/google-calendar/connection";
import {
  GCAL_RECONNECT_REQUIRED,
  gcalReconnectRequiredError,
} from "@/lib/google-calendar/errors";

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary?: boolean;
};

type GoogleCalendarListResponse = {
  items?: Array<{
    id: string;
    summary: string;
    primary?: boolean;
  }>;
};

type GoogleEventAttendee = {
  email?: string;
  displayName?: string;
  responseStatus?: string;
};

export type GoogleCalendarApiEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  organizer?: { email?: string; displayName?: string };
  attendees?: GoogleEventAttendee[];
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type GoogleEventsListResponse = {
  items?: GoogleCalendarApiEvent[];
};

async function gcalApiRequest<T>(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const accessToken = await getValidGCalAccessToken(userId);
  const res = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw gcalReconnectRequiredError(GCAL_RECONNECT_REQUIRED);
  }

  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();
  if (!text) {
    return {} as T;
  }

  const json = JSON.parse(text) as T & {
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = json.error?.message ?? `Google Calendar API error (${res.status})`;
    throw new Error(msg);
  }

  return json;
}

async function gcalApiGet<T>(userId: string, path: string): Promise<T> {
  return gcalApiRequest<T>(userId, path);
}

export async function listUserCalendars(
  userId: string,
): Promise<GoogleCalendarListItem[]> {
  const json = await gcalApiGet<GoogleCalendarListResponse>(
    userId,
    "/users/me/calendarList",
  );

  return (json.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary,
  }));
}

export async function listEvents(
  userId: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarApiEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const encodedCalendarId = encodeURIComponent(calendarId);
  const json = await gcalApiGet<GoogleEventsListResponse>(
    userId,
    `/calendars/${encodedCalendarId}/events?${params.toString()}`,
  );

  return json.items ?? [];
}

export async function getEvent(
  userId: string,
  calendarId: string,
  eventId: string,
): Promise<GoogleCalendarApiEvent> {
  const encodedCalendarId = encodeURIComponent(calendarId);
  const encodedEventId = encodeURIComponent(eventId);
  return gcalApiGet<GoogleCalendarApiEvent>(
    userId,
    `/calendars/${encodedCalendarId}/events/${encodedEventId}`,
  );
}

/** ISO date (YYYY-MM-DD) → exclusive end for Google all-day events. */
export function gcalExclusiveEndDate(endDateInclusive: string): string {
  const end = new Date(`${endDateInclusive}T12:00:00`);
  end.setDate(end.getDate() + 1);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function createAllDayEvent(
  userId: string,
  input: {
    calendarId?: string;
    summary: string;
    description?: string;
    startDate: string;
    endDateInclusive: string;
  },
): Promise<GoogleCalendarApiEvent> {
  const calendarId = input.calendarId ?? "primary";
  const encodedCalendarId = encodeURIComponent(calendarId);
  return gcalApiRequest<GoogleCalendarApiEvent>(
    userId,
    `/calendars/${encodedCalendarId}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { date: input.startDate },
        end: { date: gcalExclusiveEndDate(input.endDateInclusive) },
      }),
    },
  );
}

export async function deleteCalendarEvent(
  userId: string,
  eventId: string,
  calendarId = "primary",
): Promise<void> {
  const encodedCalendarId = encodeURIComponent(calendarId);
  const encodedEventId = encodeURIComponent(eventId);
  await gcalApiRequest<Record<string, never>>(
    userId,
    `/calendars/${encodedCalendarId}/events/${encodedEventId}`,
    { method: "DELETE" },
  );
}
