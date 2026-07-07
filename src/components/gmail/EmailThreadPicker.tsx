"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

import { GmailIcon } from "@/components/icons/GmailIcon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MotionModal } from "@/components/motion/MotionModal";
import { searchGmailThreadsForPicker } from "@/app/app/profile/gmail-actions";

export type LinkedEmailThread = {
  linkId: string;
  threadId: string;
  gmailThreadId: string;
  subject: string | null;
  gmailPermalink: string | null;
};

export function EmailThreadPicker({
  open,
  onClose,
  onSelect,
  linkedThreads = [],
  onUnlink,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (threadId: string) => void;
  linkedThreads?: LinkedEmailThread[];
  onUnlink?: (linkId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [threads, setThreads] = useState<
    Array<{
      id: string;
      subject: string | null;
      snippet: string | null;
      last_message_at: string;
      gmail_permalink: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    startTransition(async () => {
      const result = await searchGmailThreadsForPicker(search);
      if (result.ok && result.threads) {
        setThreads(result.threads);
      }
      setLoading(false);
    });
  }, [open, search]);

  return (
    <MotionModal open={open} onClose={onClose} panelClassName="max-w-md">
      <h3 className="font-display text-base font-semibold text-ink">
        Link email thread
      </h3>
      <div className="mt-4">
      {linkedThreads.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-muted">Linked</p>
          {linkedThreads.map((link) => (
            <div
              key={link.linkId}
              className="flex items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <GmailIcon size={16} />
                <span className="truncate text-sm text-ink">
                  {link.subject || "(No subject)"}
                </span>
              </div>
              {onUnlink ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onUnlink(link.linkId)}
                >
                  Unlink
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search synced threads…"
          className="pl-9"
        />
      </div>

      {loading || pending ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : threads.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No threads found. Sync Gmail in Settings or Inbox first.
        </p>
      ) : (
        <ul className="mt-3 max-h-64 divide-y divide-line overflow-y-auto rounded-[12px] border border-line">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onSelect(thread.id)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent-soft)]/40"
              >
                <GmailIcon size={16} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {thread.subject || "(No subject)"}
                  </p>
                  <p className="truncate text-xs text-muted">{thread.snippet}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </MotionModal>
  );
}
