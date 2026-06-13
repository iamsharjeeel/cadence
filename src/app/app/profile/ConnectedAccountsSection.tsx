"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, RefreshCw, Unplug } from "lucide-react";

import { MotionModal } from "@/components/motion/MotionModal";
import { Button, buttonStyles } from "@/components/ui/Button";
import type { AsanaConnectionStatus } from "@/lib/asana/connection";
import type { AsanaImportedProject } from "@/types/db";
import { AsanaImportModal } from "./AsanaImportModal";
import {
  disconnectAsana,
  removeImportedAsanaProject,
  syncImportedAsanaProjectNames,
} from "./asana-actions";

export function ConnectedAccountsSection({
  connection,
  importedProjects,
  flash,
}: {
  connection: AsanaConnectionStatus;
  importedProjects: AsanaImportedProject[];
  flash?: "connected" | "error" | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [pending, startTransition] = useTransition();
  const [syncPending, startSync] = useTransition();
  const [removePendingId, setRemovePendingId] = useState<string | null>(null);

  useEffect(() => {
    if (flash === "connected") {
      setToast("Asana connected successfully.");
      setNeedsReconnect(false);
    } else if (flash === "error") {
      setToast("Couldn't connect Asana. Please try again.");
    }
  }, [flash]);

  useEffect(() => {
    if (!flash) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("asana");
    const next = params.toString();
    router.replace(next ? `/app/profile?${next}` : "/app/profile", {
      scroll: false,
    });
  }, [flash, router, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectAsana();
      setToast(result.message);
      if (result.ok) setDisconnectOpen(false);
    });
  }

  function handleSync() {
    startSync(async () => {
      const result = await syncImportedAsanaProjectNames();
      setToast(result.message);
      if (result.needsReconnect) setNeedsReconnect(true);
    });
  }

  function handleRemove(projectId: string) {
    setRemovePendingId(projectId);
    startTransition(async () => {
      const result = await removeImportedAsanaProject(projectId);
      setToast(result.message);
      setRemovePendingId(null);
    });
  }

  return (
    <>
      {toast ? (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-line bg-[var(--accent-soft)] px-4 py-3 text-sm text-ink"
        >
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] font-display text-lg font-semibold text-[var(--accent)]">
            A
          </div>
          <div>
            <p className="font-medium text-ink">Asana</p>
            {connection.connected ? (
              <p className="mt-1 text-sm text-muted">
                Connected as{" "}
                <span className="font-medium text-ink">
                  {connection.asanaUserName ?? connection.asanaUserEmail ?? "your account"}
                </span>
                {connection.asanaUserEmail && connection.asanaUserName ? (
                  <span className="text-muted"> · {connection.asanaUserEmail}</span>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Connect your personal Asana account to browse and import projects.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {connection.connected ? (
            <>
              {needsReconnect ? (
                <Link
                  href="/api/asana/connect"
                  className={buttonStyles("primary", "sm")}
                >
                  Reconnect Asana
                </Link>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setImportOpen(true)}
              >
                Import projects
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={pending}
                onClick={() => setDisconnectOpen(true)}
              >
                <Unplug className="mr-1.5 h-4 w-4" />
                Disconnect
              </Button>
            </>
          ) : (
            <Link
              href="/api/asana/connect"
              className={buttonStyles("primary", "sm")}
            >
              Connect Asana
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {connection.connected && needsReconnect ? (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]"
        >
          Your Asana connection needs additional permissions. Reconnect to import
          projects from your workspaces.
        </div>
      ) : null}

      {connection.connected ? (
        <div className="mt-6 border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-ink">Imported projects</h3>
              <p className="text-xs text-muted">
                Personal list — linking to timesheet entries is coming next session.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={syncPending}
              onClick={handleSync}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Sync names
            </Button>
          </div>

          {importedProjects.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              No projects imported yet. Use Import projects to add some from Asana.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {importedProjects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {project.asana_project_name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {project.asana_workspace_name ?? project.asana_workspace_gid}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={removePendingId === project.id}
                    disabled={pending && removePendingId !== project.id}
                    onClick={() => handleRemove(project.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <AsanaImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(message) => {
          setNeedsReconnect(false);
          setToast(message);
        }}
        onNeedsReconnect={() => setNeedsReconnect(true)}
      />

      <MotionModal
        open={disconnectOpen}
        onClose={() => !pending && setDisconnectOpen(false)}
        panelClassName="w-full max-w-md rounded-[18px] border border-line bg-surface p-6 shadow-xl"
      >
        <h2 className="font-display text-lg font-semibold text-ink">
          Disconnect Asana?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Stored tokens will be revoked and removed. Your imported project list
          will also be cleared — you can reconnect and re-import anytime.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setDisconnectOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={pending}
            onClick={handleDisconnect}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Disconnecting…
              </>
            ) : (
              "Disconnect"
            )}
          </Button>
        </div>
      </MotionModal>
    </>
  );
}
