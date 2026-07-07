import "server-only";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REDIRECT_URI,
  );
}

export function gmailClientId(): string {
  const id = process.env.GMAIL_CLIENT_ID;
  if (!id) throw new Error("GMAIL_CLIENT_ID is not configured.");
  return id;
}

export function gmailClientSecret(): string {
  const secret = process.env.GMAIL_CLIENT_SECRET;
  if (!secret) throw new Error("GMAIL_CLIENT_SECRET is not configured.");
  return secret;
}

export function gmailRedirectUri(): string {
  const uri = process.env.GMAIL_REDIRECT_URI;
  if (!uri) throw new Error("GMAIL_REDIRECT_URI is not configured.");
  return uri;
}

export function buildGmailAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: gmailClientId(),
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export async function exchangeGmailCode(
  code: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: gmailClientId(),
    client_secret: gmailClientSecret(),
    redirect_uri: gmailRedirectUri(),
    code,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
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
        `Gmail token exchange failed (${res.status})`,
    );
  }
  return json;
}
