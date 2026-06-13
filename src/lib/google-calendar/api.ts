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

async function gcalApiGet<T>(userId: string, path: string): Promise<T> {
  const accessToken = await getValidGCalAccessToken(userId);
  const res = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw gcalReconnectRequiredError(GCAL_RECONNECT_REQUIRED);
  }

  const json = (await res.json()) as T & {
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = json.error?.message ?? `Google Calendar API error (${res.status})`;
    throw new Error(msg);
  }

  return json;
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
