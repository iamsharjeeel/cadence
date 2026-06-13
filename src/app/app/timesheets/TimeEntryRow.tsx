"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Trash2 } from "lucide-react";

import { AsanaProjectPicker, AsanaProjectPickerMeta, PROJECT_LEADING_SLOT, PROJECT_SELECT_CLASSES } from "@/components/asana/AsanaProjectPicker";
import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { asanaProjectUrl, formatAsanaSyncedAt } from "@/lib/asana/urls";

import { Button } from "@/components/ui/Button";
import { fieldBase } from "@/components/ui/Input";
import { TimePicker } from "@/components/ui/TimePicker";
import { MotionModal } from "@/components/motion/MotionModal";
import { cn } from "@/lib/utils";
import { parseDecimalHours, type EntryMode } from "@/lib/time/decimal-hours";
import { hoursBetween, isOvernightShift } from "@/lib/time/validation";
import { PROJECT_PRESET_COLORS } from "@/types/time-tracking";
import type { Project } from "@/types/time-tracking";
import type { AsanaImportedProject } from "@/types/db";

type SaveState = "idle" | "saving" | "saved" | "error";

export type EntryRowData = {
  clientId: string;
  id?: string;
  entry_date: string;
  entry_mode: EntryMode;
  start_time: string;
  end_time: string;
  decimal_hours: string;
  project_id: string | null;
  asana_project_id: string | null;
  description: string;
  billable: boolean;
  total_hours?: number | null;
  overnightConfirmed?: boolean;
  saveState: SaveState;
  error?: string;
  collapsed?: boolean;
};

const ROW_MOTION = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

function BillableToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
        checked
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "bg-[var(--line)] text-muted",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      Billable
    </button>
  );
}

function SaveIndicator({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error?: string;
  onRetry?: () => void;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)]"
      >
        <Check className="h-3 w-3" aria-hidden />
        Saved
      </motion.span>
    );
  }
  if (state === "error") {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">{error ?? "Couldn't save"}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  return null;
}

const LISTBOX_MOTION = {
  initial: { opacity: 0, y: 4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

const SELECT_CHEVRON = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236B6F76' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.85rem center",
} as const;

function CadenceProjectListbox({
  projects,
  value,
  disabled,
  editable,
  onChange,
  onNewProject,
}: {
  projects: Project[];
  value: string | null;
  disabled?: boolean;
  editable: boolean;
  onChange: (projectId: string | null) => void;
  onNewProject: () => void;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = projects.find((p) => p.id === value);
  const displayLabel = selected
    ? `${selected.is_org_wide ? "[Org] " : ""}${selected.name}`
    : "Cadence project";

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
        aria-label="Cadence project"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          PROJECT_SELECT_CLASSES,
          "flex w-full items-center text-left",
          "dark:bg-[var(--surface)] dark:text-[var(--ink)] dark:border dark:border-[var(--line)]",
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
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-[calc(var(--radius-card)-4px)] border border-[var(--line)] bg-surface py-1 shadow-card dark:bg-[var(--surface-container)] dark:border-[var(--line)] dark:shadow-none"
            {...LISTBOX_MOTION}
          >
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => pick(null)}
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]/40 dark:hover:bg-[var(--surface-low)] dark:text-[var(--ink)]",
                  value === null &&
                    "bg-[var(--accent-soft)]/30 font-medium text-[var(--accent-strong)] dark:bg-[var(--accent-soft)] dark:text-[var(--accent)]",
                  value !== null && "text-muted dark:text-[var(--ink)]",
                )}
              >
                Cadence project
              </button>
            </li>
            {projects.map((p) => (
              <li key={p.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === p.id}
                  onClick={() => pick(p.id)}
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]/40 dark:hover:bg-[var(--surface-low)] dark:text-[var(--ink)]",
                    value === p.id &&
                      "bg-[var(--accent-soft)]/30 font-medium text-ink dark:bg-[var(--accent-soft)] dark:text-[var(--accent)]",
                  )}
                >
                  <span className="truncate">
                    {p.is_org_wide ? "[Org] " : ""}
                    {p.name}
                  </span>
                </button>
              </li>
            ))}
            {editable && (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setOpen(false);
                    onNewProject();
                  }}
                  className="flex w-full px-3 py-2 text-left text-sm font-medium text-[var(--accent-strong)] transition-colors hover:bg-[var(--accent-soft)]/40 dark:text-[var(--accent)] dark:hover:bg-[var(--surface-low)]"
                >
                  + New project
                </button>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<(typeof PROJECT_PRESET_COLORS)[number]>(
    PROJECT_PRESET_COLORS[0],
  );
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await onCreate(trimmed, color);
      setName("");
      setColor(PROJECT_PRESET_COLORS[0]);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <MotionModal open={open} onClose={onClose}>
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border bg-surface p-6 shadow-card">
        <h3 className="font-display text-base font-semibold tracking-tightest text-ink">
          New project
        </h3>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink" htmlFor="new-project-name">
              Name
            </label>
            <input
              id="new-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
                if (e.key === "Escape") onClose();
              }}
              placeholder="Project name"
              autoFocus
              className={cn(fieldBase, "h-9 text-sm")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Color</span>
            <div className="flex flex-wrap gap-2">
              {PROJECT_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    color === c
                      ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-surface"
                      : "hover:scale-110",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={loading}
            disabled={!name.trim()}
            onClick={() => void handleCreate()}
          >
            Create
          </Button>
        </div>
      </div>
    </MotionModal>
  );
}

export function TimeEntryRow({
  entry,
  editable,
  projects,
  asanaConnected,
  asanaImportedProjects,
  asanaProjectNamesSyncedAt,
  asanaSyncPending,
  onPatch,
  onBlurField,
  onSave,
  onDelete,
  onBillableChange,
  onProjectChange,
  onAsanaProjectChange,
  onAsanaSync,
  onCreateProject,
  onConfirmOvernight,
  onExpand,
}: {
  entry: EntryRowData;
  editable: boolean;
  projects: Project[];
  asanaConnected: boolean;
  asanaImportedProjects: AsanaImportedProject[];
  asanaProjectNamesSyncedAt: string | null;
  asanaSyncPending?: boolean;
  onPatch: (patch: Partial<EntryRowData>) => void;
  onBlurField: (field: keyof EntryRowData, value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onBillableChange: (billable: boolean) => void;
  onProjectChange: (projectId: string | null) => void;
  onAsanaProjectChange: (asanaProjectId: string | null) => void;
  onAsanaSync?: () => void;
  onCreateProject: (name: string, color?: string) => Promise<string | null>;
  onConfirmOvernight: () => void;
  onExpand?: () => void;
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const isDecimalMode = entry.entry_mode === "decimal_hours";
  const overnight =
    !isDecimalMode &&
    entry.start_time &&
    entry.end_time &&
    isOvernightShift(entry.start_time, entry.end_time);
  const previewHours = isDecimalMode
    ? parseDecimalHours(entry.decimal_hours)
    : entry.start_time && entry.end_time
      ? hoursBetween(
          entry.start_time,
          entry.end_time,
          Boolean(entry.overnightConfirmed) || Boolean(overnight),
        )
      : null;
  const displayHours =
    entry.id && entry.total_hours != null ? entry.total_hours : previewHours;
  const selectedProject = projects.find((p) => p.id === entry.project_id);
  const selectedAsanaProject = asanaImportedProjects.find(
    (p) => p.id === entry.asana_project_id,
  );
  const isCollapsed = Boolean(entry.collapsed) && entry.id && entry.saveState !== "saving";
  const asanaSyncedLabel = formatAsanaSyncedAt(asanaProjectNamesSyncedAt);

  const hasCadenceProject = Boolean(selectedProject);
  const hasAsanaProject = Boolean(selectedAsanaProject);

  const timeSummary = isDecimalMode
    ? `${displayHours != null ? `${displayHours.toFixed(1)}h` : "—"} total`
    : entry.start_time && entry.end_time
      ? `${entry.start_time} – ${entry.end_time}${displayHours != null ? ` · ${displayHours.toFixed(1)}h` : ""}`
      : "—";

  if (isCollapsed) {
    return (
      <motion.div layout {...ROW_MOTION} className="overflow-hidden">
        <button
          type="button"
          onClick={onExpand}
          disabled={!editable}
          className={cn(
            "flex w-full items-center gap-3 rounded-[var(--radius-input)] bg-surface-low px-3 py-2.5 text-left transition-colors",
            editable && "hover:bg-[var(--accent-soft)]/40",
            !editable && "cursor-default",
          )}
        >
          <span className="tabular shrink-0 text-sm font-medium text-ink">
            {timeSummary}
          </span>
          <span className="h-3 w-px shrink-0 bg-[var(--line)]" aria-hidden />
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink">
            {hasCadenceProject ? (
              <>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedProject!.color }}
                  aria-hidden
                />
                <span className="truncate">{selectedProject!.name}</span>
              </>
            ) : hasAsanaProject ? (
              <>
                <a
                  href={asanaProjectUrl(selectedAsanaProject!.asana_project_gid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-[var(--accent-strong)]"
                >
                  <AsanaIcon size={14} />
                  <span className="truncate">{selectedAsanaProject!.asana_project_name}</span>
                </a>
                {asanaSyncedLabel ? (
                  <span className="hidden shrink-0 text-[10px] font-normal text-muted/80 sm:inline">
                    · Synced {asanaSyncedLabel}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="truncate text-muted">No project</span>
            )}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              entry.billable
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--line)] text-muted",
            )}
          >
            {entry.billable ? "Billable" : "Non-billable"}
          </span>
          {hasCadenceProject && hasAsanaProject ? (
            <>
              <span className="h-3 w-px shrink-0 bg-[var(--line)]" aria-hidden />
              <a
                href={asanaProjectUrl(selectedAsanaProject!.asana_project_gid)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex min-w-0 items-center gap-1.5 text-sm text-muted transition-colors hover:text-[var(--accent-strong)]"
              >
                <AsanaIcon size={14} />
                <span className="truncate">{selectedAsanaProject!.asana_project_name}</span>
              </a>
              {asanaSyncedLabel ? (
                <span className="hidden shrink-0 text-[10px] font-normal text-muted/80 sm:inline">
                  Synced {asanaSyncedLabel}
                </span>
              ) : null}
            </>
          ) : null}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div layout {...ROW_MOTION} className="overflow-hidden">
      <div
        className={cn(
          "rounded-[var(--radius-input)] bg-surface-low p-3",
          "flex flex-col gap-3",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-full border border-[var(--line)] p-0.5"
            role="group"
            aria-label="Entry mode"
          >
            {(["time_range", "decimal_hours"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={!editable}
                onClick={() =>
                  onPatch({
                    entry_mode: mode,
                    saveState: "idle",
                    error: undefined,
                  })
                }
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  entry.entry_mode === mode
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-muted hover:text-ink",
                  !editable && "cursor-not-allowed opacity-60",
                )}
              >
                {mode === "time_range" ? "Time range" : "Total hours"}
              </button>
            ))}
          </div>
        </div>

        {isDecimalMode ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <div className="flex min-w-[8rem] flex-col gap-1">
              <label className="text-xs font-medium text-muted">Total hours</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0.25"
                max="24"
                placeholder="7.5"
                value={entry.decimal_hours}
                disabled={!editable}
                onChange={(e) =>
                  onPatch({ decimal_hours: e.target.value, saveState: "idle" })
                }
                onBlur={() => onBlurField("decimal_hours", entry.decimal_hours)}
                className={cn(fieldBase, "h-9 w-[8rem] text-sm")}
              />
            </div>
            <span
              className={cn(
                "tabular mt-5 inline-flex flex-none items-center rounded-full px-2.5 py-1 text-xs font-medium",
                "bg-[var(--accent-soft)] text-[var(--accent)]",
              )}
            >
              {displayHours != null ? `${displayHours.toFixed(1)}h` : "—"}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <TimePicker
              value={entry.start_time}
              disabled={!editable}
              onChange={(value) =>
                onPatch({ start_time: value, saveState: "idle" })
              }
              onBlur={() => onBlurField("start_time", entry.start_time)}
              aria-label="Start time"
            />
            <span className="flex-none select-none text-sm text-muted" aria-hidden>
              –
            </span>
            <TimePicker
              value={entry.end_time}
              disabled={!editable}
              onChange={(value) =>
                onPatch({ end_time: value, saveState: "idle" })
              }
              onBlur={() => onBlurField("end_time", entry.end_time)}
              aria-label="End time"
            />
            <span
              className={cn(
                "tabular inline-flex flex-none items-center rounded-full px-2.5 py-1 text-xs font-medium",
                "bg-[var(--accent-soft)] text-[var(--accent)]",
              )}
            >
              {displayHours != null ? `${displayHours.toFixed(1)}h` : "—"}
            </span>
          </div>
        )}

        {/* Row 2: Asana project (leading) + Cadence project */}
        <div className="flex flex-col gap-1.5">
          <div
            className={cn(
              "grid gap-3",
              asanaConnected && "lg:grid-cols-2",
            )}
          >
            <AsanaProjectPicker
              connected={asanaConnected}
              importedProjects={asanaImportedProjects}
              value={entry.asana_project_id}
              disabled={!editable}
              onChange={onAsanaProjectChange}
            />

            <div className="flex min-w-0 items-center gap-2">
              <span className={PROJECT_LEADING_SLOT}>
                {selectedProject ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: selectedProject.color }}
                    aria-hidden
                  />
                ) : null}
              </span>
              <CadenceProjectListbox
                projects={projects}
                value={entry.project_id}
                disabled={!editable}
                editable={editable}
                onChange={onProjectChange}
                onNewProject={() => setCreateModalOpen(true)}
              />
            </div>
          </div>

          <AsanaProjectPickerMeta
            connected={asanaConnected}
            importedProjects={asanaImportedProjects}
            value={entry.asana_project_id}
            lastSyncedAt={asanaProjectNamesSyncedAt}
            disabled={!editable}
            syncPending={asanaSyncPending}
            onSync={onAsanaSync}
          />
        </div>

        <input
            type="text"
            placeholder="What did you work on?"
            value={entry.description}
            disabled={!editable}
            onChange={(e) =>
              onPatch({ description: e.target.value, saveState: "idle" })
            }
            onBlur={(e) => onBlurField("description", e.target.value)}
            className={cn(fieldBase, "h-9 min-w-0 w-full text-sm")}
          />

        {/* Row 3: actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
          <BillableToggle
            checked={entry.billable}
            disabled={!editable}
            onChange={onBillableChange}
          />
          {editable && (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={onSave}>
                Save
              </Button>
              <button
                type="button"
                aria-label="Delete entry"
                onClick={onDelete}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--line)] hover:text-[var(--danger)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <AnimatePresence mode="wait">
            {(entry.saveState !== "idle" || entry.error) && (
              <SaveIndicator
                state={entry.saveState}
                error={entry.error}
                onRetry={onSave}
              />
            )}
          </AnimatePresence>
        </div>

        {overnight && !entry.overnightConfirmed && editable && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onConfirmOvernight}
          >
            Confirm overnight shift
          </Button>
        )}
      </div>

      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={async (name, color) => {
          const id = await onCreateProject(name, color);
          if (id) onProjectChange(id);
        }}
      />
    </motion.div>
  );
}
