"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";

import { listAsanaProjectsForImport } from "@/app/app/profile/asana-actions";
import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { fieldBase } from "@/components/ui/Input";
import { formatAsanaSyncedAt, asanaProjectUrl } from "@/lib/asana/urls";
import { cn } from "@/lib/utils";
import type { AsanaImportedProject } from "@/types/db";

const LISTBOX_MOTION = {
  initial: { opacity: 0, y: 4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

function AsanaProjectListbox({
  importedProjects,
  value,
  disabled,
  onChange,
}: {
  importedProjects: AsanaImportedProject[];
  value: string | null;
  disabled?: boolean;
  onChange: (asanaProjectId: string | null) => void;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = importedProjects.find((p) => p.id === value);
  const displayLabel = selected?.asana_project_name ?? "Asana project";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        id={listboxId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${listboxId}-list`}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          fieldBase,
          "flex h-9 w-full items-center justify-between gap-2 py-0 pl-3 pr-2 text-left text-sm",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted")}>
          {displayLabel}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${listboxId}-list`}
            role="listbox"
            aria-labelledby={listboxId}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-surface py-1 shadow-card"
            {...LISTBOX_MOTION}
          >
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => pick(null)}
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]/40",
                  value === null && "bg-[var(--accent-soft)]/30 font-medium text-[var(--accent-strong)]",
                  value !== null && "text-muted",
                )}
              >
                Asana project
              </button>
            </li>
            {importedProjects.map((p) => (
              <li key={p.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === p.id}
                  onClick={() => pick(p.id)}
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]/40",
                    value === p.id && "bg-[var(--accent-soft)]/30 font-medium text-ink",
                  )}
                >
                  <span className="truncate">{p.asana_project_name}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyStateMessage() {
  const [importableCount, setImportableCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAsanaProjectsForImport().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok && result.projects) {
        setImportableCount(result.projects.filter((p) => !p.alreadyImported).length);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <AsanaIcon size={18} className="shrink-0" />
      <p className="min-w-0 text-sm text-muted">
        No projects imported.
        {!loading && importableCount != null && importableCount > 0 ? (
          <>
            {" "}
            <span className="font-medium text-ink">
              {importableCount} available to import
            </span>
            {" · "}
          </>
        ) : loading ? (
          " "
        ) : (
          " "
        )}
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

  const syncedLabel = formatAsanaSyncedAt(lastSyncedAt);
  const selectedProject = importedProjects.find((p) => p.id === value);

  if (importedProjects.length === 0) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-[calc(var(--radius)-4px)] border border-dashed border-[var(--line)] bg-[var(--bg)]/40 px-3 py-2">
        <EmptyStateMessage />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <AsanaIcon size={18} className="shrink-0" />
        <AsanaProjectListbox
          importedProjects={importedProjects}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
      {(syncedLabel || onSync || selectedProject) && (
        <div className="flex items-center gap-2 pl-7 text-[10px] text-muted">
          {syncedLabel ? <span>Synced {syncedLabel}</span> : null}
          {selectedProject ? (
            <Link
              href={asanaProjectUrl(selectedProject.asana_project_gid)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-[var(--accent-strong)] hover:underline"
            >
              Open in Asana
              <ExternalLink className="h-2.5 w-2.5" aria-hidden />
            </Link>
          ) : null}
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
