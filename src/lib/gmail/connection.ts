import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  GOOGLE_TOKEN_URL,
  gmailClientId,
  gmailClientSecret,
  type GoogleTokenResponse,
} from "@/lib/gmail/config";
import { decryptGmailToken, encryptGmailToken } from "@/lib/gmail/crypto";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export type GmailSyncStatus = "idle" | "running" | "error";

export type GmailConnectionRow = {
  id: string;
  user_id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string;
  gmail_email: string | null;
  history_id: string | null;
  last_full_sync_at: string | null;
  last_sync_at: string | null;
  sync_status: GmailSyncStatus;
  sync_cursor_page_token: string | null;
  threads_synced_count: number;
  sync_error: string | null;
  connected_at: string;
  updated_at: string;
};

export type GmailConnectionStatus = {
  connected: boolean;
  gmailEmail: string | null;
  connectedAt: string | null;
  syncStatus: GmailSyncStatus;
  threadsSyncedCount: number;
  lastSyncAt: string | null;
  syncError: string | null;
};

export type GmailConnectionTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  gmailEmail?: string | null;
};

export async function getGmailConnection(
  userId: string,
): Promise<GmailConnectionRow | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[gmail] connection fetch failed:", error.message);
    return null;
  }
  return data as GmailConnectionRow | null;
}

export async function getGmailConnectionStatus(
  userId: string,
): Promise<GmailConnectionStatus> {
  const row = await getGmailConnection(userId);
  if (!row) {
    return {
      connected: false,
      gmailEmail: null,
      connectedAt: null,
      syncStatus: "idle",
      threadsSyncedCount: 0,
      lastSyncAt: null,
      syncError: null,
    };
  }
  return {
    connected: true,
    gmailEmail: row.gmail_email,
    connectedAt: row.connected_at,
    syncStatus: row.sync_status,
    threadsSyncedCount: row.threads_synced_count,
    lastSyncAt: row.last_sync_at,
    syncError: row.sync_error,
  };
}

export async function hasGmailConnection(userId: string): Promise<boolean> {
  const row = await getGmailConnection(userId);
  return row !== null;
}

export async function revokeGmailToken(token: string): Promise<void> {
  const params = new URLSearchParams({ token });
  await fetch(`https://oauth2.googleapis.com/revoke?${params.toString()}`, {
    method: "POST",
    cache: "no-store",
  });
}

export async function refreshGmailToken(
  userId: string,
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: gmailClientId(),
    client_secret: gmailClientSecret(),
    refresh_token: refreshToken,
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
        `Gmail token refresh failed (${res.status})`,
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
    access_token_enc: encryptGmailToken(json.access_token),
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  if (json.refresh_token) {
    updatePayload.refresh_token_enc = encryptGmailToken(json.refresh_token);
  }

  const { error } = await db
    .from("gmail_connections")
    .update(updatePayload)
    .eq("user_id", userId);

  if (error) {
    console.error("[gmail] token refresh persist failed:", error.message);
    throw new Error("Couldn't refresh Gmail token.");
  }

  return json;
}

export async function upsertGmailConnection(
  userId: string,
  tokens: GmailConnectionTokens,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("gmail_connections").upsert(
    {
      user_id: userId,
      access_token_enc: encryptGmailToken(tokens.accessToken),
      refresh_token_enc: tokens.refreshToken
        ? encryptGmailToken(tokens.refreshToken)
        : null,
      expires_at: tokens.expiresAt.toISOString(),
      gmail_email: tokens.gmailEmail ?? null,
      sync_status: "idle",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[gmail] connection upsert failed:", error.message);
    throw new Error("Couldn't save Gmail connection.");
  }
}

export async function deleteGmailConnection(userId: string): Promise<void> {
  const db = createAdminClient();

  const { data: threads } = await db
    .from("gmail_threads")
    .select("id")
    .eq("user_id", userId);

  const threadIds = (threads ?? []).map((t) => t.id);
  if (threadIds.length) {
    await db
      .from("time_entry_email_threads")
      .delete()
      .in("gmail_thread_id", threadIds);
  }

  await db.from("gmail_messages").delete().eq("user_id", userId);
  await db.from("gmail_threads").delete().eq("user_id", userId);
  await db.from("gmail_sync_runs").delete().eq("user_id", userId);

  const { error } = await db
    .from("gmail_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[gmail] connection delete failed:", error.message);
    throw new Error("Couldn't disconnect Gmail.");
  }
}

export async function getValidGmailAccessToken(userId: string): Promise<string> {
  const row = await getGmailConnection(userId);
  if (!row) {
    throw new Error("Gmail is not connected.");
  }

  const expiresAt = new Date(row.expires_at).getTime();
  const needsRefresh = Date.now() >= expiresAt - REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return decryptGmailToken(row.access_token_enc);
  }

  const refreshToken = decryptGmailToken(row.refresh_token_enc);
  if (!refreshToken) {
    throw new Error("Gmail refresh token missing.");
  }

  const refreshed = await refreshGmailToken(userId, refreshToken);
  return refreshed.access_token;
}

export async function updateGmailConnectionSyncState(
  userId: string,
  patch: Partial<
    Pick<
      GmailConnectionRow,
      | "history_id"
      | "last_full_sync_at"
      | "last_sync_at"
      | "sync_status"
      | "sync_cursor_page_token"
      | "threads_synced_count"
      | "sync_error"
    >
  >,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("gmail_connections")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    console.error("[gmail] sync state update failed:", error.message);
    throw new Error("Couldn't update Gmail sync state.");
  }
}
