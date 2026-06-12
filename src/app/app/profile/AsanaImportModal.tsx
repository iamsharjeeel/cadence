"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { MotionModal } from "@/components/motion/MotionModal";
import { Button } from "@/components/ui/Button";
import {
  importAsanaProjects,
  listAsanaProjectsForImport,
  type AsanaProjectForImport,
} from "./asana-actions";

export function AsanaImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: (message: string) => void;
}) {
  const [projects, setProjects] = useState<AsanaProjectForImport[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setSelected(new Set());

    listAsanaProjectsForImport().then((result) => {
      setLoading(false);
      if (!result.ok || !result.projects) {
        setLoadError(result.message);
        setProjects([]);
        return;
      }
      setProjects(result.projects);
    });
  }, [open]);

  const importable = useMemo(
    () => projects.filter((p) => !p.alreadyImported),
    [projects],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AsanaProjectForImport[]>();
    for (const project of projects) {
      const list = map.get(project.workspaceName) ?? [];
      list.push(project);
      map.set(project.workspaceName, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [projects]);

  function toggle(gid: string, disabled: boolean) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  }

  function selectAllImportable() {
    setSelected(new Set(importable.map((p) => p.gid)));
  }

  function handleImport() {
    setActionError(null);
    startTransition(async () => {
      const result = await importAsanaProjects([...selected]);
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      onImported?.(result.message);
      onClose();
    });
  }

  return (
    <MotionModal open={open} onClose={onClose} panelClassName="w-full max-w-2xl rounded-[18px] border border-line bg-surface p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Import Asana projects
          </h2>
          <p className="mt-1 text-sm text-muted">
            Choose projects from your Asana workspaces. This list is personal —
            it does not change your organisation&apos;s Cadence projects yet.
          </p>
        </div>
      </div>

      <div className="mt-5 max-h-[50vh] overflow-y-auto rounded-2xl border border-line">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
            Loading projects from Asana…
          </div>
        ) : loadError ? (
          <p className="px-4 py-10 text-center text-sm text-red-600">{loadError}</p>
        ) : projects.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            No projects found in your Asana account.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {grouped.map(([workspace, workspaceProjects]) => (
              <div key={workspace}>
                <div className="sticky top-0 bg-surface/95 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted backdrop-blur">
                  {workspace}
                </div>
                <ul>
                  {workspaceProjects.map((project) => {
                    const disabled = project.alreadyImported;
                    const checked = disabled || selected.has(project.gid);
                    return (
                      <li key={project.gid}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--accent-soft)] ${
                            disabled ? "cursor-default opacity-60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-line accent-[var(--accent)]"
                            checked={checked}
                            disabled={disabled || pending}
                            onChange={() => toggle(project.gid, disabled)}
                          />
                          <span className="text-sm text-ink">{project.name}</span>
                          {disabled ? (
                            <span className="ml-auto text-xs text-muted">
                              Imported
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionError ? (
        <p className="mt-3 text-sm text-red-600">{actionError}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading || importable.length === 0 || pending}
          onClick={selectAllImportable}
        >
          Select all new
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={pending}
            disabled={loading || selected.size === 0}
            onClick={handleImport}
          >
            Import {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </div>
    </MotionModal>
  );
}
