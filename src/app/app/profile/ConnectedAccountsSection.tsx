"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import { Button, buttonStyles } from "@/components/ui/Button";
import type { AsanaConnectionStatus } from "@/lib/asana/connection";
import type { GCalConnectionStatus } from "@/lib/google-calendar/connection";
import { INLINE_EXPAND } from "@/lib/motion";
import type { AsanaImportedProject } from "@/types/db";
import { cn } from "@/lib/utils";
import { AsanaConnectionPanel } from "./AsanaConnectionPanel";
import { GoogleCalendarConnectionPanel } from "./GoogleCalendarConnectionPanel";

type OpenPanel = "asana" | "gcal" | null;

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "rounded-[var(--radius-chip)] px-2 py-0.5 text-[11px] font-medium",
        connected
          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "bg-surface-low text-muted",
      )}
    >
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

export function ConnectedAccountsSection({
  asanaConnection,
  importedProjects,
  gcalConnection,
  asanaFlash,
  gcalFlash,
}: {
  asanaConnection: AsanaConnectionStatus;
  importedProjects: AsanaImportedProject[];
  gcalConnection: GCalConnectionStatus;
  asanaFlash?: "connected" | "error" | null;
  gcalFlash?: "connected" | "error" | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);

  useEffect(() => {
    if (asanaFlash === "connected") {
      setToast("Asana connected successfully.");
    } else if (asanaFlash === "error") {
      setToast("Couldn't connect Asana. Please try again.");
    } else if (gcalFlash === "connected") {
      setToast("Google Calendar connected successfully.");
    } else if (gcalFlash === "error") {
      setToast("Couldn't connect Google Calendar. Please try again.");
    }
  }, [asanaFlash, gcalFlash]);

  useEffect(() => {
    if (!asanaFlash && !gcalFlash) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("asana");
    params.delete("gcal");
    const next = params.toString();
    router.replace(next ? `/app/user-settings?${next}` : "/app/user-settings", {
      scroll: false,
    });
  }, [asanaFlash, gcalFlash, router, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function toggle(panel: Exclude<OpenPanel, null>) {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  }

  return (
    <>
      {toast ? (
        <div
          role="status"
          className="mb-4 rounded-[12px] border border-line bg-[var(--accent-soft)] px-4 py-3 text-sm text-ink"
        >
          {toast}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Asana tile */}
        <div className="min-w-0 rounded-[12px] bg-surface p-5 shadow-card">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#F06A6A]/10">
              <AsanaIcon size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink">Asana</p>
                <ConnectionBadge connected={asanaConnection.connected} />
              </div>
              {asanaConnection.connected ? (
                <p className="mt-1 truncate text-sm text-muted">
                  {asanaConnection.asanaUserEmail ??
                    asanaConnection.asanaUserName ??
                    "Connected account"}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  Import projects for time entry tagging.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            {asanaConnection.connected ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => toggle("asana")}
              >
                {openPanel === "asana" ? "Close" : "Manage"}
              </Button>
            ) : (
              <Link
                href="/api/asana/connect"
                className={buttonStyles("primary", "sm")}
              >
                Connect
              </Link>
            )}
          </div>
        </div>

        {/* Google Calendar tile */}
        <div className="min-w-0 rounded-[12px] bg-surface p-5 shadow-card">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#4285F4]/10">
              <GoogleCalendarIcon size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink">Google Calendar</p>
                <ConnectionBadge connected={gcalConnection.connected} />
              </div>
              {gcalConnection.connected ? (
                <p className="mt-1 truncate text-sm text-muted">
                  {gcalConnection.googleEmail ?? "Connected account"}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  Sync events to leave calendar and time log suggestions.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            {gcalConnection.connected ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => toggle("gcal")}
              >
                {openPanel === "gcal" ? "Close" : "Manage"}
              </Button>
            ) : (
              <Link
                href="/api/google-calendar/connect"
                className={buttonStyles("primary", "sm")}
              >
                Connect
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Inline expandable sub-section — one at a time, no modal/backdrop */}
      <AnimatePresence mode="wait">
        {openPanel === "asana" && asanaConnection.connected && (
          <motion.div
            key="asana-panel"
            {...INLINE_EXPAND}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <AsanaConnectionPanel
                connection={asanaConnection}
                importedProjects={importedProjects}
                onToast={setToast}
                onDisconnected={() => setOpenPanel(null)}
              />
            </div>
          </motion.div>
        )}

        {openPanel === "gcal" && gcalConnection.connected && (
          <motion.div
            key="gcal-panel"
            {...INLINE_EXPAND}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <GoogleCalendarConnectionPanel
                connection={gcalConnection}
                onToast={setToast}
                onDisconnected={() => setOpenPanel(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
