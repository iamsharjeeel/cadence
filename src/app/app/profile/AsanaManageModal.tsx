"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Unplug } from "lucide-react";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
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

export function AsanaManageModal({
  open,
  onClose,
  connection,
  importedProjects,
  onToast,
  onNeedsReconnect,
}: {
  open: boolean;
  onClose: () => void;
  connection: AsanaConnectionStatus;
  importedProjects: AsanaImportedProject[];
  onToast: (message: string) => void;
  onNeedsReconnect: () => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [pending, startTransition] = useTransition();
  const [syncPending, startSync] = useTransition();
  const [removePendingId, setRemovePendingId] = useState<string | null>(null);

  function handleSync() {
    startSync(async () => {
      const result = await syncImportedAsanaProjectNames();
      onToast(result.message);
      if (result.needsReconnect) {
        setNeedsReconnect(true);
        onNeedsReconnect();
      }
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
    startTransition(async () => {
      const result = await disconnectAsana();
      onToast(result.message);
      if (result.ok) {
        setDisconnectOpen(false);
        onClose();
      }
    });
  }

  return (
    <>
      <MotionModal
        open={open}
        onClose={onClose}
        panelClassName="flex max-h-[80vh] max-w-lg flex-col"
      >
        <div className="flex shrink-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#F06A6A]/10">
            <AsanaIcon size={22} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Asana</h2>
            <p className="mt-1 text-sm text-muted">
              Connected as{" "}
              <span className="font-medium text-ink">
                {connection.asanaUserName ??
                  connection.asanaUserEmail ??
                  "your account"}
              </span>
            </p>
            {connection.asanaUserEmail && connection.asanaUserName ? (
              <p className="text-sm text-muted">{connection.asanaUserEmail}</p>
            ) : null}
            {connection.connectedAt ? (
              <p className="mt-1 text-xs text-muted">
                Connected{" "}
                {new Date(connection.connectedAt).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {needsReconnect ? (
            <div className="mt-4 rounded-[12px] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
              Your Asana connection needs additional permissions.
              <Link
                href="/api/asana/connect"
                className={`${buttonStyles("primary", "sm")} mt-3`}
              >
                Reconnect Asana
              </Link>
            </div>
          ) : null}

          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink">Imported projects</h3>
                <p className="text-xs text-muted">
                  Tag time entries from the log view.
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
              <p className="rounded-[12px] border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                No projects imported yet.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-[12px] border border-line">
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
        </div>

        <div className="mt-6 flex shrink-0 justify-end border-t border-line pt-5">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setDisconnectOpen(true)}
          >
            <Unplug className="mr-1.5 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </MotionModal>

      <AsanaImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(message) => {
          setNeedsReconnect(false);
          onToast(message);
        }}
        onNeedsReconnect={() => {
          setNeedsReconnect(true);
          onNeedsReconnect();
        }}
      />

      <MotionModal
        open={disconnectOpen}
        onClose={() => !pending && setDisconnectOpen(false)}
        panelClassName="max-w-md"
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
