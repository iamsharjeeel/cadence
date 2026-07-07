"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Mail, RefreshCw, Search } from "lucide-react";

import { GmailIcon } from "@/components/icons/GmailIcon";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MotionModal } from "@/components/motion/MotionModal";
import type { GmailConnectionStatus } from "@/lib/gmail/connection";
import type { GmailMessageRow, GmailThreadRow } from "@/lib/gmail/sync";
import { cn } from "@/lib/utils";
import {
  fetchInboxThreadDetail,
  fetchInboxThreads,
  syncGmailInbox,
} from "@/app/app/profile/gmail-actions";

type Filter = "all" | "unread" | "linked";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function InboxView({
  connection,
}: {
  connection: GmailConnectionStatus;
}) {
  const [threads, setThreads] = useState<GmailThreadRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncPending, startSync] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    thread: GmailThreadRow;
    messages: GmailMessageRow[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const syncInFlight = useRef(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const result = await fetchInboxThreads({ filter, search });
    if (result.ok && result.threads) {
      setThreads(result.threads);
    }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  async function runSyncLoop(restart = false) {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      let done = false;
      while (!done) {
        const result = await syncGmailInbox({ restart });
        if (!result.ok || result.needsReconnect) break;
        done = Boolean(result.done);
        if (done) await loadThreads();
        restart = false;
        if (!done) await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      syncInFlight.current = false;
    }
  }

  function handleSync() {
    startSync(() => {
      void runSyncLoop(false);
    });
  }

  useEffect(() => {
    if (connection.syncStatus === "running") {
      handleSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openThread(threadId: string) {
    setSelectedId(threadId);
    setDetailLoading(true);
    const result = await fetchInboxThreadDetail(threadId);
    if (result.ok && result.thread && result.messages) {
      setDetail({ thread: result.thread, messages: result.messages });
    }
    setDetailLoading(false);
  }

  if (!connection.connected) {
    return (
      <div className="rounded-[12px] border border-dashed border-line bg-surface-low px-6 py-12 text-center">
        <Mail className="mx-auto h-10 w-10 text-muted" />
        <p className="mt-3 text-sm text-muted">
          Connect Gmail in settings to sync your inbox.
        </p>
        <Link
          href="/app/user-settings#section-connected"
          className={cn(buttonStyles("primary", "sm"), "mt-4 inline-flex")}
        >
          Connect Gmail
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-[var(--radius-input)] border border-line p-0.5">
          {(["all", "unread", "linked"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject or snippet…"
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={syncPending}
          onClick={handleSync}
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted">
        {connection.gmailEmail} · {connection.threadsSyncedCount} threads cached
        {connection.syncStatus === "running" ? " · Syncing…" : null}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading inbox…
        </div>
      ) : threads.length === 0 ? (
        <div className="mt-6 rounded-[12px] border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
          No threads yet. Click Refresh to sync your Gmail inbox.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-surface">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => openThread(thread.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent-soft)]/30"
              >
                <GmailIcon size={18} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "truncate text-sm",
                        thread.is_unread ? "font-semibold text-ink" : "text-ink",
                      )}
                    >
                      {thread.subject || "(No subject)"}
                    </p>
                    {thread.is_unread ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted">{thread.snippet}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {relativeTime(thread.last_message_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <MotionModal
        open={selectedId !== null}
        onClose={() => {
          setSelectedId(null);
          setDetail(null);
        }}
        panelClassName="max-w-2xl"
      >
        <h3 className="font-display text-base font-semibold text-ink">
          {detail?.thread.subject ?? "Email thread"}
        </h3>
        <div className="mt-4">
        {detailLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading thread…
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {detail.thread.gmail_permalink ? (
                <a
                  href={detail.thread.gmail_permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonStyles("secondary", "sm"), "inline-flex items-center gap-1")}
                >
                  Open in Gmail
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <Link
                href="/app/timesheets/log"
                className={cn(buttonStyles("ghost", "sm"))}
              >
                Link from time log
              </Link>
            </div>
            <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-[12px] border border-line">
              {detail.messages.map((msg) => (
                <li key={msg.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {msg.from_name ?? msg.from_email ?? "Unknown"}
                    </p>
                    <span className="shrink-0 text-xs text-muted">
                      {relativeTime(msg.received_at)}
                    </span>
                  </div>
                  {msg.from_email ? (
                    <p className="text-xs text-muted">{msg.from_email}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-ink">{msg.snippet}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        </div>
      </MotionModal>
    </>
  );
}
