"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { fieldBase } from "@/components/ui/Input";
import { TimePicker } from "@/components/ui/TimePicker";
import { MotionModal } from "@/components/motion/MotionModal";
import { cn } from "@/lib/utils";
import { parseDecimalHours, type EntryMode } from "@/lib/time/decimal-hours";
import { hoursBetween, isOvernightShift } from "@/lib/time/validation";
import { PROJECT_PRESET_COLORS } from "@/types/time-tracking";
import type { Project } from "@/types/time-tracking";

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
          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
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
      <div className="w-full max-w-sm rounded-[var(--radius)] border bg-surface p-6 shadow-card">
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
  onPatch,
  onBlurField,
  onSave,
  onDelete,
  onBillableChange,
  onProjectChange,
  onCreateProject,
  onConfirmOvernight,
  onExpand,
}: {
  entry: EntryRowData;
  editable: boolean;
  projects: Project[];
  onPatch: (patch: Partial<EntryRowData>) => void;
  onBlurField: (field: keyof EntryRowData, value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onBillableChange: (billable: boolean) => void;
  onProjectChange: (projectId: string | null) => void;
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
  const isCollapsed = Boolean(entry.collapsed) && entry.id && entry.saveState !== "saving";

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
            "flex w-full items-center gap-3 rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)]/50 px-3 py-2.5 text-left transition-colors",
            editable && "hover:bg-[var(--accent-soft)]/40",
            !editable && "cursor-default",
          )}
        >
          <span className="tnum shrink-0 text-sm font-medium text-ink">
            {timeSummary}
          </span>
          <span className="h-3 w-px shrink-0 bg-[var(--line)]" aria-hidden />
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink">
            {selectedProject ? (
              <>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedProject.color }}
                  aria-hidden
                />
                <span className="truncate">{selectedProject.name}</span>
              </>
            ) : (
              <span className="truncate text-muted">No project</span>
            )}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              entry.billable
                ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                : "bg-[var(--line)] text-muted",
            )}
          >
            {entry.billable ? "Billable" : "Non-billable"}
          </span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div layout {...ROW_MOTION} className="overflow-hidden">
      <div
        className={cn(
          "rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)]/50 p-3",
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
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
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
                "tnum mt-5 inline-flex flex-none items-center rounded-full px-2.5 py-1 text-xs font-medium",
                "bg-[var(--line)] text-muted",
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
                "tnum inline-flex flex-none items-center rounded-full px-2.5 py-1 text-xs font-medium",
                "bg-[var(--line)] text-muted",
              )}
            >
              {displayHours != null ? `${displayHours.toFixed(1)}h` : "—"}
            </span>
          </div>
        )}

        {/* Row 2: project + description */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2">
            {selectedProject ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: selectedProject.color }}
                aria-hidden
              />
            ) : (
              <span className="h-2 w-2 shrink-0" aria-hidden />
            )}
            <select
              value={entry.project_id ?? ""}
              disabled={!editable}
              onChange={async (e) => {
                if (e.target.value === "__new__") {
                  /* Reset to previous value while modal is open */
                  e.target.value = entry.project_id ?? "";
                  setCreateModalOpen(true);
                  return;
                }
                onProjectChange(e.target.value === "" ? null : e.target.value);
              }}
              className={cn(fieldBase, "h-9 min-w-0 flex-1 py-0 text-sm")}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.is_org_wide ? "[Org] " : ""}
                  {p.name}
                </option>
              ))}
              {editable && <option value="__new__">+ New project</option>}
            </select>
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
            className={cn(fieldBase, "h-9 min-w-0 text-sm")}
          />
        </div>

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
