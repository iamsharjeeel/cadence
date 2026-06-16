"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { fieldBase } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { AsanaImportedProject } from "@/types/db";
import type { Project } from "@/types/time-tracking";

export type ProjectPickerValue = {
  projectId: string | null;
  asanaProjectId: string | null;
};

const PICKER_CLASSES = cn(
  fieldBase,
  "h-9 min-w-0 w-full py-0 text-sm appearance-none pr-9",
  "dark:bg-[var(--surface)] dark:text-[var(--ink)] dark:border dark:border-[var(--line)]",
);

const SELECT_CHEVRON = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236B6F76' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.85rem center",
} as const;

const LISTBOX_MOTION = {
  initial: { opacity: 0, y: 4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

function SectionHeader({ label }: { label: string }) {
  return (
    <li
      role="presentation"
      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted dark:text-[var(--ink-muted)]"
    >
      {label}
    </li>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
        "hover:bg-[var(--accent-soft)]/40 dark:hover:bg-[var(--surface-low)] dark:text-[var(--ink)]",
        selected &&
          "bg-[var(--accent-soft)]/30 font-medium text-ink dark:bg-[var(--accent-soft)] dark:text-[var(--accent)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ProjectPicker({
  hasAsana,
  asanaProjects,
  cadenceProjects,
  projectId,
  asanaProjectId,
  disabled,
  editable = true,
  onChange,
  onNewProject,
}: {
  hasAsana: boolean;
  asanaProjects: AsanaImportedProject[];
  cadenceProjects: Project[];
  projectId: string | null;
  asanaProjectId: string | null;
  disabled?: boolean;
  editable?: boolean;
  onChange: (value: ProjectPickerValue) => void;
  onNewProject?: () => void;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const showAsanaSection = hasAsana && asanaProjects.length > 0;

  const selectedCadence = cadenceProjects.find((p) => p.id === projectId);
  const selectedAsana = asanaProjects.find((p) => p.id === asanaProjectId);

  const displayLabel = useMemo(() => {
    if (selectedCadence) {
      return selectedCadence.name;
    }
    if (selectedAsana) return selectedAsana.asana_project_name;
    return "Project";
  }, [selectedCadence, selectedAsana]);

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

  function pickCadence(id: string | null) {
    onChange({ projectId: id, asanaProjectId: null });
    setOpen(false);
  }

  function pickAsana(id: string | null) {
    onChange({ projectId: null, asanaProjectId: id });
    setOpen(false);
  }

  function clearSelection() {
    onChange({ projectId: null, asanaProjectId: null });
    setOpen(false);
  }

  const isPlaceholder = !selectedCadence && !selectedAsana;

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <button
        type="button"
        id={listboxId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${listboxId}-list`}
        aria-label="Project"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          PICKER_CLASSES,
          "flex items-center text-left",
          disabled && "cursor-not-allowed opacity-60",
        )}
        style={SELECT_CHEVRON}
      >
        <span className={cn("flex min-w-0 items-center gap-2 truncate", isPlaceholder && "text-muted")}>
          {selectedAsana && !selectedCadence ? (
            <AsanaIcon size={14} />
          ) : selectedCadence ? (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selectedCadence.color }}
              aria-hidden
            />
          ) : null}
          <span className="truncate">{displayLabel}</span>
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
              <OptionButton
                selected={isPlaceholder}
                onClick={clearSelection}
                className={!isPlaceholder ? "text-muted" : undefined}
              >
                Project
              </OptionButton>
            </li>

            {showAsanaSection && (
              <>
                <SectionHeader label="Asana" />
                {asanaProjects.map((p) => (
                  <li key={`asana-${p.id}`} role="presentation">
                    <OptionButton
                      selected={asanaProjectId === p.id}
                      onClick={() => pickAsana(p.id)}
                    >
                      <AsanaIcon size={14} />
                      <span className="truncate">{p.asana_project_name}</span>
                    </OptionButton>
                  </li>
                ))}
                <li role="presentation" className="my-1 border-t border-[var(--line)]" />
                <SectionHeader label="Projects" />
              </>
            )}

            {cadenceProjects.map((p) => (
              <li key={p.id} role="presentation">
                <OptionButton
                  selected={projectId === p.id}
                  onClick={() => pickCadence(p.id)}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                    aria-hidden
                  />
                  <span className="truncate">
                    {p.name}
                  </span>
                </OptionButton>
              </li>
            ))}

            {editable && onNewProject && (
              <li role="presentation">
                <OptionButton
                  selected={false}
                  onClick={() => {
                    setOpen(false);
                    onNewProject();
                  }}
                  className="font-medium text-[var(--accent-strong)] dark:text-[var(--accent)]"
                >
                  + New project
                </OptionButton>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
