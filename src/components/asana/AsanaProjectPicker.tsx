"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { fieldBase } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { AsanaImportedProject } from "@/types/db";

function formatSyncedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AsanaProjectPicker({
  connected,
  importedProjects,
  value,
  lastSyncedAt,
  disabled,
  onChange,
  onSync,
  syncPending,
}: {
  connected: boolean;
  importedProjects: AsanaImportedProject[];
  value: string | null;
  lastSyncedAt: string | null;
  disabled?: boolean;
  onChange: (asanaProjectId: string | null) => void;
  onSync?: () => void;
  syncPending?: boolean;
}) {
  if (!connected) return null;

  const syncedLabel = formatSyncedAt(lastSyncedAt);

  if (importedProjects.length === 0) {
    return (
      <div
        className="flex min-w-0 items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-dashed border-[var(--line)] bg-[var(--bg)]/40 px-3 py-2"
      >
        <AsanaIcon size={18} />
        <p className="min-w-0 text-xs text-muted">
          No projects imported.{" "}
          <Link
            href="/app/profile#section-connected"
            className="font-medium text-[var(--accent-strong)] hover:underline"
          >
            Connected accounts
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <AsanaIcon size={18} />
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : e.target.value)
          }
          aria-label="Asana project"
          className={cn(
            fieldBase,
            "h-9 min-w-0 flex-1 py-0 text-sm",
            "border-[#F06A6A]/25 bg-[#F06A6A]/[0.04]",
          )}
        >
          <option value="">Asana project (optional)</option>
          {importedProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.asana_project_name}
            </option>
          ))}
        </select>
      </div>
      {(syncedLabel || onSync) && (
        <div className="flex items-center gap-2 pl-7 text-[10px] text-muted">
          {syncedLabel ? <span>Synced {syncedLabel}</span> : null}
          {onSync ? (
            <button
              type="button"
              disabled={disabled || syncPending}
              onClick={onSync}
              className="inline-flex items-center gap-1 font-medium text-[var(--accent-strong)] hover:underline disabled:opacity-50"
            >
              <RefreshCw
                className={cn("h-3 w-3", syncPending && "animate-spin")}
                aria-hidden
              />
              Refresh
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
