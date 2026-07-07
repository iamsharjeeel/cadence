"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveProfile } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { isGmailConfigured } from "@/lib/gmail/config";
import {
  deleteGmailConnection,
  getGmailConnection,
  revokeGmailToken,
} from "@/lib/gmail/connection";
import { decryptGmailToken } from "@/lib/gmail/crypto";
import { isGmailReconnectRequiredError } from "@/lib/gmail/errors";
import {
  getGmailThreadWithMessages,
  listGmailThreadsForUser,
  resetGmailFullSync,
  runGmailSyncBatch,
  type GmailMessageRow,
  type GmailThreadRow,
} from "@/lib/gmail/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext } from "@/lib/workspace";

export type GmailActionResult = {
  ok: boolean;
  message: string;
  needsReconnect?: boolean;
};

export type GmailSyncActionResult = GmailActionResult & {
  done?: boolean;
  threadsProcessed?: number;
  totalThreadsSynced?: number;
  syncStatus?: "idle" | "running" | "error";
};

function gmailActionError(err: unknown): GmailActionResult {
  if (isGmailReconnectRequiredError(err)) {
    return {
      ok: false,
      message: "Reconnect Gmail to continue.",
      needsReconnect: true,
    };
  }
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Gmail request failed.",
  };
}

export async function connectGmail(): Promise<void> {
  await requireActiveProfile();
  if (!isGmailConfigured()) {
    throw new Error("Gmail integration is not configured.");
  }
  redirect("/api/gmail/connect");
}

export async function disconnectGmail(): Promise<GmailActionResult> {
  const profile = await requireActiveProfile();

  try {
    const connection = await getGmailConnection(profile.id);
    if (connection) {
      const accessToken = decryptGmailToken(connection.access_token_enc);
      if (accessToken) {
        await revokeGmailToken(accessToken).catch((err) => {
          console.error("[gmail] revoke failed (continuing):", err);
        });
      }
    }

    await deleteGmailConnection(profile.id);
    revalidatePath("/app/user-settings");
    revalidatePath("/app/inbox");
    revalidatePath("/app/timesheets/log");
    return { ok: true, message: "Gmail disconnected." };
  } catch (err) {
    console.error("[gmail] disconnect failed:", err);
    return gmailActionError(err);
  }
}

export async function syncGmailInbox(
  options?: { restart?: boolean },
): Promise<GmailSyncActionResult> {
  const profile = await requireActiveProfile();

  try {
    if (options?.restart) {
      await resetGmailFullSync(profile.id);
    }

    const result = await runGmailSyncBatch(profile.id);
    revalidatePath("/app/inbox");
    revalidatePath("/app/user-settings");

    return {
      ok: result.syncStatus !== "error",
      message: result.done
        ? `Sync complete — ${result.totalThreadsSynced} threads cached.`
        : `Synced ${result.threadsProcessed} threads (${result.totalThreadsSynced} total)…`,
      done: result.done,
      threadsProcessed: result.threadsProcessed,
      totalThreadsSynced: result.totalThreadsSynced,
      syncStatus: result.syncStatus,
    };
  } catch (err) {
    console.error("[gmail] sync failed:", err);
    return gmailActionError(err);
  }
}

export async function fetchInboxThreads(options?: {
  filter?: "all" | "unread" | "linked";
  search?: string;
}): Promise<GmailActionResult & { threads?: GmailThreadRow[] }> {
  const profile = await requireActiveProfile();

  try {
    const threads = await listGmailThreadsForUser(profile.id, {
      filter: options?.filter ?? "all",
      search: options?.search,
      limit: 200,
    });
    return { ok: true, message: "OK", threads };
  } catch (err) {
    return gmailActionError(err);
  }
}

export async function fetchInboxThreadDetail(threadUuid: string): Promise<
  GmailActionResult & {
    thread?: GmailThreadRow;
    messages?: GmailMessageRow[];
  }
> {
  const profile = await requireActiveProfile();
  try {
    const detail = await getGmailThreadWithMessages(profile.id, threadUuid);
    if (!detail) {
      return { ok: false, message: "Thread not found." };
    }
    return { ok: true, message: "OK", ...detail };
  } catch (err) {
    return gmailActionError(err);
  }
}

export async function linkEmailThreadToTimeEntry(input: {
  timeEntryId: string;
  gmailThreadId: string;
}): Promise<GmailActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const db = createAdminClient();
  const { data: entry } = await db
    .from("time_entries")
    .select("id, employee_id, org_id")
    .eq("id", input.timeEntryId)
    .maybeSingle();

  if (!entry || entry.employee_id !== ctx.realProfile.id) {
    return { ok: false, message: "Time entry not found." };
  }

  const { data: thread } = await db
    .from("gmail_threads")
    .select("id, user_id, subject, gmail_thread_id")
    .eq("id", input.gmailThreadId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!thread || thread.user_id !== ctx.realProfile.id) {
    return { ok: false, message: "Email thread not found." };
  }

  const { error } = await db.from("time_entry_email_threads").upsert(
    {
      time_entry_id: input.timeEntryId,
      gmail_thread_id: input.gmailThreadId,
      linked_by: ctx.realProfile.id,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "time_entry_id,gmail_thread_id" },
  );

  if (error) {
    console.error("[gmail] link failed:", error.message);
    return { ok: false, message: "Couldn't link email thread." };
  }

  await writeAudit({
    actorId: ctx.realProfile.id,
    orgId: entry.org_id,
    action: "time_entry_email_linked",
    entity: "time_entries",
    payload: {
      time_entry_id: input.timeEntryId,
      gmail_thread_id: thread.gmail_thread_id,
      subject: thread.subject,
    },
  });

  revalidatePath("/app/timesheets/log");
  revalidatePath("/app/time-tracked");
  revalidatePath("/app/inbox");
  return { ok: true, message: "Email thread linked." };
}

export async function unlinkEmailThreadFromTimeEntry(input: {
  linkId: string;
}): Promise<GmailActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const db = createAdminClient();
  const { data: link } = await db
    .from("time_entry_email_threads")
    .select("id, time_entry_id, linked_by, gmail_threads(subject, gmail_thread_id)")
    .eq("id", input.linkId)
    .maybeSingle();

  if (!link || link.linked_by !== ctx.realProfile.id) {
    return { ok: false, message: "Link not found." };
  }

  const { data: entry } = await db
    .from("time_entries")
    .select("org_id")
    .eq("id", link.time_entry_id)
    .maybeSingle();

  const { error } = await db
    .from("time_entry_email_threads")
    .delete()
    .eq("id", input.linkId);

  if (error) {
    return { ok: false, message: "Couldn't unlink email thread." };
  }

  const threadMeta = link.gmail_threads as {
    subject: string | null;
    gmail_thread_id: string;
  } | null;

  await writeAudit({
    actorId: ctx.realProfile.id,
    orgId: entry?.org_id ?? null,
    action: "time_entry_email_unlinked",
    entity: "time_entries",
    payload: {
      time_entry_id: link.time_entry_id,
      gmail_thread_id: threadMeta?.gmail_thread_id ?? null,
      subject: threadMeta?.subject ?? null,
    },
  });

  revalidatePath("/app/timesheets/log");
  revalidatePath("/app/time-tracked");
  revalidatePath("/app/inbox");
  return { ok: true, message: "Email thread unlinked." };
}

export async function searchGmailThreadsForPicker(
  search: string,
): Promise<
  GmailActionResult & {
    threads?: Array<{
      id: string;
      subject: string | null;
      snippet: string | null;
      last_message_at: string;
      gmail_permalink: string | null;
    }>;
  }
> {
  const profile = await requireActiveProfile();
  const threads = await listGmailThreadsForUser(profile.id, {
    search,
    limit: 50,
  });
  return {
    ok: true,
    message: "OK",
    threads: threads.map((t) => ({
      id: t.id,
      subject: t.subject,
      snippet: t.snippet,
      last_message_at: t.last_message_at,
      gmail_permalink: t.gmail_permalink,
    })),
  };
}
