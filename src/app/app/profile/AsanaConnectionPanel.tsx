"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { Button, buttonStyles } from "@/components/ui/Button";
import type { AsanaConnectionStatus } from "@/lib/asana/connection";
import type { AsanaImportedProject } from "@/types/db";
import { AsanaImportModal } from "./AsanaImportModal";
import { InlineDisconnect } from "./InlineDisconnect";
import {
  disconnectAsana,
  removeImportedAsanaProject,
  syncImportedAsanaProjectNames,
} from "./asana-actions";

export function AsanaConnectionPanel({
  connection,
  importedProjects,
  onToast,
  onDisconnected,
}: {
  connection: AsanaConnectionStatus;
  importedProjects: AsanaImportedProject[];
  onToast: (message: string) => void;
  onDisconnected: () => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [pending, startTransition] = useTransition();
  const [syncPending, startSync] = useTransition();
  const [disconnectPending, startDisconnect] = useTransition();
  const [removePendingId, setRemovePendingId] = useState<string | null>(null);

  function handleSync() {
    startSync(async () => {
      const result = await syncImportedAsanaProjectNames();
      onToast(result.message);
      if (result.needsReconnect) setNeedsReconnect(true);
    });
  }

  function handleRemove(projectId: string) {
    setRemovePendingId(projectId);
    startTransition(async () => {
      const result = await removeImportedAsanaProject(projectId);
      onToast(result.message);
      setRemovePendingId(null);
    });
  }

  function handleDisconnect() {
    startDisconnect(async () => {
      const result = await disconnectAsana();
      onToast(result.message);
      if (result.ok) onDisconnected();
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface-low p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-[#F06A6A]/10">
          <AsanaIcon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink">Asana</h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            {connection.asanaUserEmail ??
              connection.asanaUserName ??
              "Connected account"}
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
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          Your Asana connection needs additional permissions.
          <Link href="/api/asana/connect" className={buttonStyles("primary", "sm")}>
            Reconnect Asana
          </Link>
        </div>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-ink">Imported projects</h4>
            <p className="text-xs text-muted">Tag time entries from the log view.</p>
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
          <p className="rounded-[var(--radius-card)] border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
            No projects imported yet.
          </p>
        ) : (
          <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-[var(--radius-card)] border border-line">
            {importedProjects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
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

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => setImportOpen(true)}
        >
          Import more projects
        </Button>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <InlineDisconnect
          confirmText="Disconnect Asana? Imported projects will be cleared."
          pending={disconnectPending}
          onConfirm={handleDisconnect}
        />
      </div>

      <AsanaImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(message) => {
          setNeedsReconnect(false);
          onToast(message);
        }}
        onNeedsReconnect={() => setNeedsReconnect(true)}
      />
    </div>
  );
}
