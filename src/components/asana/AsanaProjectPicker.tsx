"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, RefreshCw } from "lucide-react";

import { listAsanaProjectsForImport } from "@/app/app/profile/asana-actions";
import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { fieldBase } from "@/components/ui/Input";
import { formatAsanaSyncedAt, asanaProjectUrl } from "@/lib/asana/urls";
import { cn } from "@/lib/utils";
import type { AsanaImportedProject } from "@/types/db";

/** Matches Cadence project `<select>` in TimeEntryRow — keep in sync. */
export const PROJECT_SELECT_CLASSES = cn(
  fieldBase,
  "h-9 min-w-0 flex-1 py-0 text-sm appearance-none pr-9",
);

const SELECT_CHEVRON = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236B6F76' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.85rem center",
} as const;

/** Fixed leading slot width — pairs with Cadence color dot column. */
export const PROJECT_LEADING_SLOT =
  "flex h-9 w-[18px] shrink-0 items-center justify-center";

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
        aria-label="Asana project"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          PROJECT_SELECT_CLASSES,
          "flex w-full items-center text-left",
          disabled && "cursor-not-allowed opacity-60",
        )}
        style={SELECT_CHEVRON}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted")}>
          {displayLabel}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${listboxId}-list`}
            role="listbox"
            aria-labelledby={listboxId}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-[calc(var(--radius-card)-4px)] border border-[var(--line)] bg-surface py-1 shadow-card"
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
    <p className="min-w-0 truncate text-sm text-muted">
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
        Connect accounts
      </Link>
    </p>
  );
}

/** Single h-9 field row — matches Cadence project select row height/width. */
export function AsanaProjectPicker({
  connected,
  importedProjects,
  value,
  disabled,
  onChange,
}: {
  connected: boolean;
  importedProjects: AsanaImportedProject[];
  value: string | null;
  disabled?: boolean;
  onChange: (asanaProjectId: string | null) => void;
}) {
  if (!connected) return null;

  if (importedProjects.length === 0) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className={PROJECT_LEADING_SLOT}>
          <AsanaIcon size={14} />
        </span>
        <div className={cn(PROJECT_SELECT_CLASSES, "flex items-center px-3.5")}>
          <EmptyStateMessage />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={PROJECT_LEADING_SLOT}>
        <AsanaIcon size={14} />
      </span>
      <AsanaProjectListbox
        importedProjects={importedProjects}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

/** Sync / link metadata — rendered below the project grid, not inside the field row. */
export function AsanaProjectPickerMeta({
  connected,
  importedProjects,
  value,
  lastSyncedAt,
  disabled,
  onSync,
  syncPending,
}: {
  connected: boolean;
  importedProjects: AsanaImportedProject[];
  value: string | null;
  lastSyncedAt: string | null;
  disabled?: boolean;
  onSync?: () => void;
  syncPending?: boolean;
}) {
  if (!connected || importedProjects.length === 0) return null;

  const syncedLabel = formatAsanaSyncedAt(lastSyncedAt);
  const selectedProject = importedProjects.find((p) => p.id === value);

  if (!syncedLabel && !onSync && !selectedProject) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
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
  );
}
