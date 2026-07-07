import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getGmailProfile,
  getGmailThread,
  getHeader,
  listGmailHistory,
  listGmailThreads,
  parseEmailAddress,
  parseParticipants,
  sleep,
  type GmailApiMessage,
} from "@/lib/gmail/api";
import {
  getGmailConnection,
  updateGmailConnectionSyncState,
} from "@/lib/gmail/connection";
import { gmailThreadUrl } from "@/lib/gmail/urls";

const THREADS_PER_BATCH = 40;
const REQUEST_DELAY_MS = 80;

export type GmailThreadRow = {
  id: string;
  user_id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: Array<{ email: string; name: string | null }>;
  last_message_at: string;
  is_unread: boolean;
  label_ids: string[];
  gmail_permalink: string | null;
  synced_at: string;
  deleted_at: string | null;
};

export type GmailMessageRow = {
  id: string;
  user_id: string;
  thread_uuid: string;
  gmail_message_id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  body_text: string | null;
};

export type GmailSyncBatchResult = {
  done: boolean;
  threadsProcessed: number;
  totalThreadsSynced: number;
  syncStatus: "idle" | "running" | "error";
  syncError: string | null;
};

function latestMessage(messages: GmailApiMessage[]): GmailApiMessage | null {
  if (!messages.length) return null;
  return [...messages].sort(
    (a, b) => Number(b.internalDate ?? 0) - Number(a.internalDate ?? 0),
  )[0]!;
}

function messageReceivedAt(message: GmailApiMessage): string {
  const ms = Number(message.internalDate ?? 0);
  if (ms > 0) return new Date(ms).toISOString();
  const dateHeader = getHeader(message.payload?.headers, "Date");
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

async function upsertThreadFromApi(
  userId: string,
  threadId: string,
): Promise<string | null> {
  const thread = await getGmailThread(userId, threadId, "metadata");
  const messages = thread.messages ?? [];
  if (!messages.length) return null;

  const latest = latestMessage(messages)!;
  const subject =
    getHeader(latest.payload?.headers, "Subject") ??
    getHeader(messages[0]?.payload?.headers, "Subject");
  const participants = parseParticipants(messages);
  const lastMessageAt = messageReceivedAt(latest);
  const labelIds = latest.labelIds ?? [];
  const isUnread = labelIds.includes("UNREAD");
  const snippet = thread.snippet ?? latest.snippet ?? null;
  const now = new Date().toISOString();

  const db = createAdminClient();
  const { data: threadRow, error: threadErr } = await db
    .from("gmail_threads")
    .upsert(
      {
        user_id: userId,
        gmail_thread_id: threadId,
        subject,
        snippet,
        participants,
        last_message_at: lastMessageAt,
        is_unread: isUnread,
        label_ids: labelIds,
        gmail_permalink: gmailThreadUrl(threadId),
        synced_at: now,
        deleted_at: null,
      },
      { onConflict: "user_id,gmail_thread_id" },
    )
    .select("id")
    .single();

  if (threadErr || !threadRow) {
    console.error("[gmail] thread upsert failed:", threadErr?.message);
    return null;
  }

  for (const msg of messages) {
    const fromRaw = getHeader(msg.payload?.headers, "From");
    const { email, name } = parseEmailAddress(fromRaw);
    const msgSubject =
      getHeader(msg.payload?.headers, "Subject") ?? subject ?? null;

    await db.from("gmail_messages").upsert(
      {
        user_id: userId,
        thread_uuid: threadRow.id,
        gmail_message_id: msg.id,
        from_email: email,
        from_name: name,
        subject: msgSubject,
        snippet: msg.snippet ?? null,
        received_at: messageReceivedAt(msg),
      },
      { onConflict: "user_id,gmail_message_id" },
    );
  }

  return threadRow.id;
}

async function runIncrementalSync(userId: string): Promise<number> {
  const connection = await getGmailConnection(userId);
  if (!connection?.history_id) return 0;

  const threadIds = new Set<string>();
  let pageToken: string | null = null;
  let latestHistoryId = connection.history_id;

  try {
    do {
      const history = await listGmailHistory(
        userId,
        connection.history_id,
        pageToken,
      );
      if (history.historyId) latestHistoryId = history.historyId;

      for (const record of history.history ?? []) {
        for (const item of record.messagesAdded ?? []) {
          if (item.message.threadId) threadIds.add(item.message.threadId);
        }
        for (const item of record.labelsAdded ?? []) {
          if (item.message.threadId) threadIds.add(item.message.threadId);
        }
        for (const item of record.labelsRemoved ?? []) {
          if (item.message.threadId) threadIds.add(item.message.threadId);
        }
        for (const msg of record.messages ?? []) {
          if (msg.threadId) threadIds.add(msg.threadId);
        }
      }

      pageToken = history.nextPageToken ?? null;
      if (pageToken) await sleep(REQUEST_DELAY_MS);
    } while (pageToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("historyId") || message.includes("404")) {
      return 0;
    }
    throw err;
  }

  let processed = 0;
  for (const threadId of threadIds) {
    await upsertThreadFromApi(userId, threadId);
    processed += 1;
    await sleep(REQUEST_DELAY_MS);
  }

  await updateGmailConnectionSyncState(userId, {
    history_id: latestHistoryId,
  });

  return processed;
}

export async function runGmailSyncBatch(
  userId: string,
): Promise<GmailSyncBatchResult> {
  const connection = await getGmailConnection(userId);
  if (!connection) {
    return {
      done: true,
      threadsProcessed: 0,
      totalThreadsSynced: 0,
      syncStatus: "idle",
      syncError: null,
    };
  }

  const db = createAdminClient();
  const runStarted = new Date().toISOString();
  const { data: syncRun } = await db
    .from("gmail_sync_runs")
    .insert({ user_id: userId, started_at: runStarted })
    .select("id")
    .single();

  try {
    const profile = await getGmailProfile(userId);
    if (profile.historyId && !connection.history_id) {
      await updateGmailConnectionSyncState(userId, {
        history_id: profile.historyId,
      });
    }

    const refreshedConn = (await getGmailConnection(userId))!;
    const fullSyncComplete =
      Boolean(refreshedConn.last_full_sync_at) &&
      refreshedConn.sync_status !== "running";

    if (fullSyncComplete && !refreshedConn.sync_cursor_page_token) {
      const incremental = await runIncrementalSync(userId);
      await updateGmailConnectionSyncState(userId, {
        last_sync_at: new Date().toISOString(),
        sync_status: "idle",
        sync_error: null,
      });
      await db
        .from("gmail_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          threads_processed: incremental,
        })
        .eq("id", syncRun?.id ?? "");

      const after = await getGmailConnection(userId);
      return {
        done: true,
        threadsProcessed: incremental,
        totalThreadsSynced: after?.threads_synced_count ?? 0,
        syncStatus: "idle",
        syncError: null,
      };
    }

    if (refreshedConn.sync_status !== "running") {
      await updateGmailConnectionSyncState(userId, {
        sync_status: "running",
        sync_error: null,
      });
    }

    const current = await getGmailConnection(userId);
    const pageToken = current?.sync_cursor_page_token ?? null;
    const list = await listGmailThreads(userId, pageToken, THREADS_PER_BATCH);

    let batchCount = 0;
    for (const item of list.threads ?? []) {
      await upsertThreadFromApi(userId, item.id);
      batchCount += 1;
      await sleep(REQUEST_DELAY_MS);
    }

    const nextToken = list.nextPageToken ?? null;
    const totalSynced =
      (current?.threads_synced_count ?? 0) + batchCount;
    const done = !nextToken;

    if (done) {
      const profile = await getGmailProfile(userId);
      await updateGmailConnectionSyncState(userId, {
        sync_status: "idle",
        sync_cursor_page_token: null,
        threads_synced_count: totalSynced,
        last_full_sync_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        history_id: profile.historyId ?? current?.history_id ?? null,
        sync_error: null,
      });
    } else {
      await updateGmailConnectionSyncState(userId, {
        sync_status: "running",
        sync_cursor_page_token: nextToken,
        threads_synced_count: totalSynced,
      });
    }

    await db
      .from("gmail_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        threads_processed: batchCount,
      })
      .eq("id", syncRun?.id ?? "");

    const refreshed = await getGmailConnection(userId);
    return {
      done,
      threadsProcessed: batchCount,
      totalThreadsSynced: refreshed?.threads_synced_count ?? totalSynced,
      syncStatus: done ? "idle" : "running",
      syncError: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync failed.";
    console.error("[gmail] sync batch failed:", err);
    await updateGmailConnectionSyncState(userId, {
      sync_status: "error",
      sync_error: message,
    });
    await db
      .from("gmail_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", syncRun?.id ?? "");

    const refreshed = await getGmailConnection(userId);
    return {
      done: false,
      threadsProcessed: 0,
      totalThreadsSynced: refreshed?.threads_synced_count ?? 0,
      syncStatus: "error",
      syncError: message,
    };
  }
}

export async function resetGmailFullSync(userId: string): Promise<void> {
  await updateGmailConnectionSyncState(userId, {
    sync_status: "running",
    sync_cursor_page_token: null,
    threads_synced_count: 0,
    sync_error: null,
    last_full_sync_at: null,
  });
}

export async function listGmailThreadsForUser(
  userId: string,
  options?: {
    filter?: "all" | "unread" | "linked";
    search?: string;
    limit?: number;
  },
): Promise<GmailThreadRow[]> {
  const db = createAdminClient();
  let query = db
    .from("gmail_threads")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.filter === "unread") {
    query = query.eq("is_unread", true);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[gmail] list threads failed:", error.message);
    return [];
  }

  let rows = (data ?? []) as GmailThreadRow[];

  if (options?.filter === "linked") {
    const rowIds = rows.map((r) => r.id);
    if (!rowIds.length) return [];
    const { data: links } = await db
      .from("time_entry_email_threads")
      .select("gmail_thread_id")
      .in("gmail_thread_id", rowIds);
    const linkedIds = new Set((links ?? []).map((l) => l.gmail_thread_id));
    rows = rows.filter((r) => linkedIds.has(r.id));
  }

  const search = options?.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (r) =>
        r.subject?.toLowerCase().includes(search) ||
        r.snippet?.toLowerCase().includes(search),
    );
  }

  return rows;
}

export async function getGmailThreadWithMessages(
  userId: string,
  threadUuid: string,
): Promise<{ thread: GmailThreadRow; messages: GmailMessageRow[] } | null> {
  const db = createAdminClient();
  const { data: thread } = await db
    .from("gmail_threads")
    .select("*")
    .eq("user_id", userId)
    .eq("id", threadUuid)
    .is("deleted_at", null)
    .maybeSingle();

  if (!thread) return null;

  const { data: messages } = await db
    .from("gmail_messages")
    .select("*")
    .eq("thread_uuid", threadUuid)
    .order("received_at", { ascending: true });

  return {
    thread: thread as GmailThreadRow,
    messages: (messages ?? []) as GmailMessageRow[],
  };
}

export async function loadLinkedThreadsForEntries(
  entryIds: string[],
): Promise<
  Map<
    string,
    Array<{
      linkId: string;
      threadId: string;
      gmailThreadId: string;
      subject: string | null;
      gmailPermalink: string | null;
    }>
  >
> {
  const map = new Map<
    string,
    Array<{
      linkId: string;
      threadId: string;
      gmailThreadId: string;
      subject: string | null;
      gmailPermalink: string | null;
    }>
  >();
  if (!entryIds.length) return map;

  const db = createAdminClient();
  const { data, error } = await db
    .from("time_entry_email_threads")
    .select(
      "id, time_entry_id, gmail_thread_id, gmail_threads(id, gmail_thread_id, subject, gmail_permalink)",
    )
    .in("time_entry_id", entryIds);

  if (error) {
    console.error("[gmail] load linked threads failed:", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const thread = row.gmail_threads as {
      id: string;
      gmail_thread_id: string;
      subject: string | null;
      gmail_permalink: string | null;
    } | null;
    if (!thread) continue;
    const list = map.get(row.time_entry_id) ?? [];
    list.push({
      linkId: row.id,
      threadId: thread.id,
      gmailThreadId: thread.gmail_thread_id,
      subject: thread.subject,
      gmailPermalink: thread.gmail_permalink,
    });
    map.set(row.time_entry_id, list);
  }

  return map;
}
