import "server-only";

import { GMAIL_API_BASE } from "@/lib/gmail/config";
import { getValidGmailAccessToken } from "@/lib/gmail/connection";
import {
  GMAIL_RECONNECT_REQUIRED,
  gmailReconnectRequiredError,
} from "@/lib/gmail/errors";

export type GmailHeader = { name: string; value: string };

export type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
};

export type GmailApiMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: GmailHeader[];
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: GmailMessagePart[];
  };
};

export type GmailApiThread = {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: GmailApiMessage[];
};

type GmailThreadsListResponse = {
  threads?: Array<{ id: string; snippet?: string; historyId?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailHistoryListResponse = {
  history?: Array<{
    id?: string;
    messages?: Array<{ id: string; threadId: string }>;
    messagesAdded?: Array<{ message: GmailApiMessage }>;
    labelsAdded?: Array<{ message: GmailApiMessage }>;
    labelsRemoved?: Array<{ message: GmailApiMessage }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
};

type GmailProfileResponse = {
  emailAddress?: string;
  historyId?: string;
  messagesTotal?: number;
  threadsTotal?: number;
};

async function gmailApiRequest<T>(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const accessToken = await getValidGmailAccessToken(userId);
  const res = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw gmailReconnectRequiredError(GMAIL_RECONNECT_REQUIRED);
  }

  if (res.status === 429) {
    throw new Error("Gmail rate limit exceeded. Try again shortly.");
  }

  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();
  if (!text) {
    return {} as T;
  }

  const json = JSON.parse(text) as T & {
    error?: { message?: string; code?: number };
  };

  if (!res.ok) {
    throw new Error(
      json.error?.message ?? `Gmail API request failed (${res.status})`,
    );
  }

  return json;
}

export async function getGmailProfile(
  userId: string,
): Promise<GmailProfileResponse> {
  return gmailApiRequest<GmailProfileResponse>(userId, "/users/me/profile");
}

export async function listGmailThreads(
  userId: string,
  pageToken?: string | null,
  maxResults = 100,
): Promise<GmailThreadsListResponse> {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);
  return gmailApiRequest<GmailThreadsListResponse>(
    userId,
    `/users/me/threads?${params.toString()}`,
  );
}

export async function getGmailThread(
  userId: string,
  threadId: string,
  format: "metadata" | "full" = "metadata",
): Promise<GmailApiThread> {
  const params = new URLSearchParams({ format });
  for (const header of ["From", "To", "Subject", "Date"]) {
    params.append("metadataHeaders", header);
  }
  return gmailApiRequest<GmailApiThread>(
    userId,
    `/users/me/threads/${threadId}?${params.toString()}`,
  );
}

export async function getGmailMessage(
  userId: string,
  messageId: string,
  format: "metadata" | "full" = "full",
): Promise<GmailApiMessage> {
  const params = new URLSearchParams({ format });
  return gmailApiRequest<GmailApiMessage>(
    userId,
    `/users/me/messages/${messageId}?${params.toString()}`,
  );
}

export async function listGmailHistory(
  userId: string,
  startHistoryId: string,
  pageToken?: string | null,
): Promise<GmailHistoryListResponse> {
  const params = new URLSearchParams({ startHistoryId });
  for (const type of ["messageAdded", "labelAdded", "labelRemoved"]) {
    params.append("historyTypes", type);
  }
  if (pageToken) params.set("pageToken", pageToken);
  return gmailApiRequest<GmailHistoryListResponse>(
    userId,
    `/users/me/history?${params.toString()}`,
  );
}

export function getHeader(
  headers: GmailHeader[] | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const found = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function extractPlainTextBody(message: GmailApiMessage): string | null {
  const walk = (part: GmailMessagePart | undefined): string | null => {
    if (!part) return null;
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const child of part.parts) {
        const text = walk(child);
        if (text) return text;
      }
    }
    if (part.body?.data && part.mimeType?.startsWith("text/")) {
      return decodeBase64Url(part.body.data);
    }
    return null;
  };

  if (message.payload?.body?.data && message.payload.mimeType === "text/plain") {
    return decodeBase64Url(message.payload.body.data);
  }
  return walk(message.payload);
}

export function parseEmailAddress(raw: string | null): {
  email: string | null;
  name: string | null;
} {
  if (!raw) return { email: null, name: null };
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (!match) return { email: raw.trim(), name: null };
  return {
    name: match[1]?.trim() || null,
    email: match[2]?.trim() || null,
  };
}

export function parseParticipants(messages: GmailApiMessage[]): Array<{
  email: string;
  name: string | null;
}> {
  const seen = new Set<string>();
  const out: Array<{ email: string; name: string | null }> = [];
  for (const msg of messages) {
    for (const headerName of ["From", "To", "Cc"]) {
      const raw = getHeader(msg.payload?.headers, headerName);
      if (!raw) continue;
      for (const part of raw.split(",")) {
        const { email, name } = parseEmailAddress(part.trim());
        if (!email || seen.has(email.toLowerCase())) continue;
        seen.add(email.toLowerCase());
        out.push({ email, name });
      }
    }
  }
  return out;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
