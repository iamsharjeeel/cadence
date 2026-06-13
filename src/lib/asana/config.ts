import "server-only";

const AUTHORIZE_URL = "https://app.asana.com/-/oauth_authorize";
const TOKEN_URL = "https://app.asana.com/-/oauth_token";
const REVOKE_URL = "https://app.asana.com/-/oauth_revoke";
const API_BASE = "https://app.asana.com/api/1.0";

/**
 * Single source of truth for required Asana OAuth scopes.
 * Add new scopes here when future features need them (e.g. tasks:read).
 * Must match scopes enabled in the Asana developer console.
 */
export const ASANA_REQUIRED_SCOPES = ["projects:read", "workspaces:read"] as const;

/** Space-delimited scope string for the OAuth authorize request. */
export const ASANA_OAUTH_SCOPES = ASANA_REQUIRED_SCOPES.join(" ");

export function asanaClientId(): string {
  const id = process.env.ASANA_CLIENT_ID;
  if (!id) throw new Error("ASANA_CLIENT_ID is not configured.");
  return id;
}

export function asanaClientSecret(): string {
  const secret = process.env.ASANA_CLIENT_SECRET;
  if (!secret) throw new Error("ASANA_CLIENT_SECRET is not configured.");
  return secret;
}

export function asanaRedirectUri(): string {
  const uri = process.env.ASANA_REDIRECT_URI;
  if (!uri) throw new Error("ASANA_REDIRECT_URI is not configured.");
  return uri;
}

export function buildAsanaAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: asanaClientId(),
    redirect_uri: asanaRedirectUri(),
    response_type: "code",
    state,
    scope: ASANA_OAUTH_SCOPES,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeAsanaCode(code: string): Promise<AsanaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: asanaClientId(),
    client_secret: asanaClientSecret(),
    redirect_uri: asanaRedirectUri(),
    code,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = (await res.json()) as AsanaTokenResponse & { error?: string };
  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Asana token exchange failed (${res.status})`);
  }
  return json;
}

export async function refreshAsanaToken(
  refreshToken: string,
): Promise<AsanaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: asanaClientId(),
    client_secret: asanaClientSecret(),
    redirect_uri: asanaRedirectUri(),
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = (await res.json()) as AsanaTokenResponse & { error?: string };
  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Asana token refresh failed (${res.status})`);
  }
  return json;
}

export async function revokeAsanaToken(token: string): Promise<void> {
  const body = new URLSearchParams({
    client_id: asanaClientId(),
    client_secret: asanaClientSecret(),
    token,
  });

  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

import {
  asanaInsufficientScopeError,
  isAsanaInsufficientScopeMessage,
} from "@/lib/asana/errors";

export async function asanaApiGet<T>(
  path: string,
  accessToken: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const json = (await res.json()) as T & { errors?: { message: string }[] };
  if (!res.ok) {
    const msg = json.errors?.[0]?.message ?? `Asana API error (${res.status})`;
    if (isAsanaInsufficientScopeMessage(msg)) {
      throw asanaInsufficientScopeError(msg);
    }
    throw new Error(msg);
  }
  return json;
}

export type AsanaTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  data?: {
    gid: string;
    name: string;
    email?: string;
  };
};

export type AsanaWorkspace = { gid: string; name: string };
export type AsanaProject = {
  gid: string;
  name: string;
  workspace?: { gid: string; name: string };
};
