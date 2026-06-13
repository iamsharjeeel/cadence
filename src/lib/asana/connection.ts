import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptAsanaToken,
  encryptAsanaToken,
} from "@/lib/asana-crypto";
import {
  refreshAsanaToken,
  type AsanaTokenResponse,
} from "@/lib/asana/config";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export type AsanaConnectionRow = {
  id: string;
  user_id: string;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: string;
  asana_user_gid: string | null;
  asana_user_name: string | null;
  asana_user_email: string | null;
  connected_at: string;
  updated_at: string;
  project_names_synced_at: string | null;
};

export type AsanaConnectionStatus = {
  connected: boolean;
  asanaUserName: string | null;
  asanaUserEmail: string | null;
  connectedAt: string | null;
  projectNamesSyncedAt: string | null;
};

export type AsanaConnectionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export async function getAsanaConnection(
  userId: string,
): Promise<AsanaConnectionRow | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("asana_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[asana] connection fetch failed:", error.message);
    return null;
  }
  return data as AsanaConnectionRow | null;
}

export async function getAsanaConnectionStatus(
  userId: string,
): Promise<AsanaConnectionStatus> {
  const row = await getAsanaConnection(userId);
  if (!row) {
    return {
      connected: false,
      asanaUserName: null,
      asanaUserEmail: null,
      connectedAt: null,
      projectNamesSyncedAt: null,
    };
  }
  return {
    connected: true,
    asanaUserName: row.asana_user_name,
    asanaUserEmail: row.asana_user_email,
    connectedAt: row.connected_at,
    projectNamesSyncedAt: row.project_names_synced_at,
  };
}

export async function hasAsanaConnection(userId: string): Promise<boolean> {
  const row = await getAsanaConnection(userId);
  return row !== null;
}

export async function upsertAsanaConnection(
  userId: string,
  tokens: AsanaTokenResponse,
): Promise<void> {
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    throw new Error("Asana did not return a refresh token.");
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const db = createAdminClient();

  const { error } = await db.from("asana_connections").upsert(
    {
      user_id: userId,
      access_token_enc: encryptAsanaToken(tokens.access_token),
      refresh_token_enc: encryptAsanaToken(refreshToken),
      expires_at: expiresAt,
      asana_user_gid: tokens.data?.gid ?? null,
      asana_user_name: tokens.data?.name ?? null,
      asana_user_email: tokens.data?.email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[asana] connection upsert failed:", error.message);
    throw new Error("Couldn't save Asana connection.");
  }
}

export async function deleteAsanaConnection(userId: string): Promise<void> {
  const db = createAdminClient();

  const { error: projectsErr } = await db
    .from("asana_imported_projects")
    .delete()
    .eq("user_id", userId);

  if (projectsErr) {
    console.error("[asana] imported projects delete failed:", projectsErr.message);
    throw new Error("Couldn't clear imported projects.");
  }

  const { error } = await db
    .from("asana_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[asana] connection delete failed:", error.message);
    throw new Error("Couldn't disconnect Asana.");
  }
}

/**
 * Returns a valid access token, refreshing via refresh_token when expired or
 * within five minutes of expiry.
 */
export async function getValidAsanaAccessToken(
  userId: string,
): Promise<string> {
  const row = await getAsanaConnection(userId);
  if (!row) {
    throw new Error("Asana is not connected.");
  }

  const expiresAt = new Date(row.expires_at).getTime();
  const needsRefresh = Date.now() >= expiresAt - REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return decryptAsanaToken(row.access_token_enc);
  }

  const refreshToken = decryptAsanaToken(row.refresh_token_enc);
  const refreshed = await refreshAsanaToken(refreshToken);
  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000,
  ).toISOString();

  const db = createAdminClient();
  const { error } = await db
    .from("asana_connections")
    .update({
      access_token_enc: encryptAsanaToken(refreshed.access_token),
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
      ...(refreshed.data?.gid ? { asana_user_gid: refreshed.data.gid } : {}),
      ...(refreshed.data?.name ? { asana_user_name: refreshed.data.name } : {}),
      ...(refreshed.data?.email
        ? { asana_user_email: refreshed.data.email }
        : {}),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[asana] token refresh persist failed:", error.message);
    throw new Error("Couldn't refresh Asana token.");
  }

  return refreshed.access_token;
}
