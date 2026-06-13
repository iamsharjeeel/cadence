import "server-only";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  // Lets the callback read the connected account email for display.
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export const GOOGLE_CALENDAR_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_CALENDAR_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_CALENDAR_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export function googleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not configured.");
  return id;
}

export function googleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not configured.");
  return secret;
}

export function googleCalendarRedirectUri(): string {
  const uri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  if (!uri) throw new Error("GOOGLE_CALENDAR_REDIRECT_URI is not configured.");
  return uri;
}

export function buildGoogleCalendarAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: googleCalendarRedirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_CALENDAR_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export async function exchangeGoogleCalendarCode(
  code: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    redirect_uri: googleCalendarRedirectUri(),
    code,
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
      json.error_description ?? json.error ?? `Google token exchange failed (${res.status})`,
    );
  }
  return json;
}
