import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptGCalToken,
  encryptGCalToken,
} from "@/lib/google-calendar/crypto";
import {
  GOOGLE_CALENDAR_TOKEN_URL,
  googleClientId,
  googleClientSecret,
  type GoogleTokenResponse,
} from "@/lib/google-calendar/config";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export type GCalConnectionRow = {
  id: string;
  user_id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string;
  google_email: string | null;
  connected_at: string;
  updated_at: string;
};

export type GCalConnectionStatus = {
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
};

export type GCalConnectionTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  googleEmail?: string | null;
};

export async function getGCalConnection(
  userId: string,
): Promise<GCalConnectionRow | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[gcal] connection fetch failed:", error.message);
    return null;
  }
  return data as GCalConnectionRow | null;
}

export async function getGCalConnectionStatus(
  userId: string,
): Promise<GCalConnectionStatus> {
  const row = await getGCalConnection(userId);
  if (!row) {
    return { connected: false, googleEmail: null, connectedAt: null };
  }
  return {
    connected: true,
    googleEmail: row.google_email,
    connectedAt: row.connected_at,
  };
}

export async function hasGCalConnection(userId: string): Promise<boolean> {
  const row = await getGCalConnection(userId);
  return row !== null;
}

export async function revokeGCalToken(token: string): Promise<void> {
  const params = new URLSearchParams({ token });
  await fetch(
    `https://oauth2.googleapis.com/revoke?${params.toString()}`,
    { method: "POST", cache: "no-store" },
  );
}

export async function refreshGCalToken(
  userId: string,
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    refresh_token: refreshToken,
  });

  const res = await fetch(GOOGLE_CALENDAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await res.json()) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || json.error) {
    throw new Error(
      json.error_description ??
        json.error ??
        `Google token refresh failed (${res.status})`,
    );
  }

  const expiresAt = new Date(
    Date.now() + json.expires_in * 1000,
  ).toISOString();
  const db = createAdminClient();

  const updatePayload: {
    access_token_enc: string;
    expires_at: string;
    updated_at: string;
    refresh_token_enc?: string;
  } = {
    access_token_enc: encryptGCalToken(json.access_token),
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  if (json.refresh_token) {
    updatePayload.refresh_token_enc = encryptGCalToken(json.refresh_token);
  }

  const { error } = await db
    .from("google_calendar_connections")
    .update(updatePayload)
    .eq("user_id", userId);

  if (error) {
    console.error("[gcal] token refresh persist failed:", error.message);
    throw new Error("Couldn't refresh Google Calendar token.");
  }

  return json;
}

export async function upsertGCalConnection(
  userId: string,
  tokens: GCalConnectionTokens,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("google_calendar_connections").upsert(
    {
      user_id: userId,
      access_token_enc: encryptGCalToken(tokens.accessToken),
      refresh_token_enc: tokens.refreshToken
        ? encryptGCalToken(tokens.refreshToken)
        : null,
      expires_at: tokens.expiresAt.toISOString(),
      google_email: tokens.googleEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[gcal] connection upsert failed:", error.message);
    throw new Error("Couldn't save Google Calendar connection.");
  }
}

export async function deleteGCalConnection(userId: string): Promise<void> {
  const db = createAdminClient();

  const { error: eventsErr } = await db
    .from("google_calendar_events")
    .delete()
    .eq("user_id", userId);

  if (eventsErr) {
    console.error("[gcal] events delete failed:", eventsErr.message);
    throw new Error("Couldn't clear calendar events.");
  }

  const { error: calendarsErr } = await db
    .from("google_selected_calendars")
    .delete()
    .eq("user_id", userId);

  if (calendarsErr) {
    console.error("[gcal] selected calendars delete failed:", calendarsErr.message);
    throw new Error("Couldn't clear selected calendars.");
  }

  const { error } = await db
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[gcal] connection delete failed:", error.message);
    throw new Error("Couldn't disconnect Google Calendar.");
  }
}

/**
 * Returns a valid access token, refreshing via refresh_token when expired or
 * within five minutes of expiry.
 */
export async function getValidGCalAccessToken(userId: string): Promise<string> {
  const row = await getGCalConnection(userId);
  if (!row) {
    throw new Error("Google Calendar is not connected.");
  }

  const expiresAt = new Date(row.expires_at).getTime();
  const needsRefresh = Date.now() >= expiresAt - REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return decryptGCalToken(row.access_token_enc);
  }

  const refreshToken = decryptGCalToken(row.refresh_token_enc);
  if (!refreshToken) {
    throw new Error("Google Calendar refresh token missing.");
  }

  const refreshed = await refreshGCalToken(userId, refreshToken);
  return refreshed.access_token;
}
