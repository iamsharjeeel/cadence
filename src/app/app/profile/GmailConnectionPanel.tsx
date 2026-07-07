"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";

import { GmailIcon } from "@/components/icons/GmailIcon";
import { Button, buttonStyles } from "@/components/ui/Button";
import type { GmailConnectionStatus } from "@/lib/gmail/connection";
import { InlineDisconnect } from "./InlineDisconnect";
import {
  disconnectGmail,
  syncGmailInbox,
} from "./gmail-actions";

export function GmailConnectionPanel({
  connection,
  gmailConfigured,
  onToast,
  onDisconnected,
}: {
  connection: GmailConnectionStatus;
  gmailConfigured: boolean;
  onToast: (message: string) => void;
  onDisconnected: () => void;
}) {
  const [syncPending, startSync] = useTransition();
  const [disconnectPending, startDisconnect] = useTransition();
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const syncInFlight = useRef(false);

  async function runSyncLoop(restart = false) {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      let done = false;
      while (!done) {
        const result = await syncGmailInbox({ restart });
        onToast(result.message);
        if (result.needsReconnect) {
          setNeedsReconnect(true);
          break;
        }
        done = Boolean(result.done);
        if (!result.ok) break;
        if (!done) {
          await new Promise((r) => setTimeout(r, 300));
        }
        restart = false;
      }
    } finally {
      syncInFlight.current = false;
    }
  }

  function handleSync(restart = false) {
    startSync(() => {
      void runSyncLoop(restart);
    });
  }

  function handleDisconnect() {
    startDisconnect(async () => {
      const result = await disconnectGmail();
      onToast(result.message);
      if (result.ok) onDisconnected();
    });
  }

  useEffect(() => {
    if (connection.connected && connection.syncStatus === "running") {
      handleSync(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!gmailConfigured) {
    return (
      <div className="rounded-[12px] border border-line bg-surface-low p-5 text-sm text-muted">
        Gmail integration is not configured on this deployment.
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-line bg-surface-low p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#EA4335]/10">
          <GmailIcon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink">Gmail</h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            {connection.gmailEmail ?? "Connected account"}
          </p>
          {connection.connectedAt ? (
            <p className="text-xs text-muted">
              Connected{" "}
              {new Date(connection.connectedAt).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </p>
          ) : null}
        </div>
      </div>

      {needsReconnect ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          Your Gmail connection expired.
          <Link href="/api/gmail/connect" className={buttonStyles("primary", "sm")}>
            Reconnect Gmail
          </Link>
        </div>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-ink">Inbox sync</h4>
            <p className="text-xs text-muted">
              {connection.threadsSyncedCount > 0
                ? `${connection.threadsSyncedCount} threads cached`
                : "Sync your inbox into Cadence"}
            </p>
            {connection.lastSyncAt ? (
              <p className="text-[11px] text-muted">
                Last synced{" "}
                {new Date(connection.lastSyncAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
            {connection.syncError ? (
              <p className="mt-1 text-xs text-[var(--danger)]">{connection.syncError}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={syncPending}
              disabled={syncInFlight.current}
              onClick={() => handleSync(false)}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Sync
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={syncPending}
              disabled={syncInFlight.current}
              onClick={() => handleSync(true)}
            >
              Full resync
            </Button>
          </div>
        </div>
        {connection.syncStatus === "running" ? (
          <p className="mt-3 flex items-center text-xs text-muted">
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Sync in progress…
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted">
          <Link href="/app/inbox" className="text-[var(--accent-strong)] hover:underline">
            Open inbox
          </Link>
        </p>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <InlineDisconnect
          confirmText="Disconnect Gmail? Cached threads and time entry links will be removed."
          pending={disconnectPending}
          onConfirm={handleDisconnect}
        />
      </div>
    </div>
  );
}
