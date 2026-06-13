"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PROJECT_PRESET_COLORS, type Project } from "@/types/time-tracking";
import {
  archiveProject,
  createProject,
} from "./actions";

export function ProjectsManager({
  projects,
  isManager,
  orgId,
  orgNameById,
  requiresOrgSelection,
}: {
  projects: Project[];
  isManager: boolean;
  orgId?: string;
  orgNameById?: Record<string, string>;
  requiresOrgSelection?: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROJECT_PRESET_COLORS[0]);
  const [orgWide, setOrgWide] = useState(false);
  const [orgError, setOrgError] = useState("");

  const orgWideProjects = projects.filter((p) => p.is_org_wide);
  const personalProjects = projects.filter((p) => !p.is_org_wide);
  const showOrgColumn = Boolean(orgNameById && Object.keys(orgNameById).length > 0);

  function onCreate() {
    if (requiresOrgSelection && !orgId) {
      setOrgError("Please select an organisation first.");
      return;
    }
    setOrgError("");

    startTransition(async () => {
      const res = await createProject({
        name,
        color,
        isOrgWide: isManager ? orgWide : false,
        orgId,
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setName("");
        window.location.reload();
      } else if (res.message === "Please select an organisation first.") {
        setOrgError(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {requiresOrgSelection && !orgId && (
        <p className="rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-3 text-sm text-[var(--danger)]">
          Select an organisation above before creating projects.
        </p>
      )}

      <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-card">
        <h3 className="font-display text-base font-semibold">Create project</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">Color</span>
            <div className="flex flex-wrap gap-2">
              {PROJECT_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={`h-9 w-9 rounded-full border-2 shadow-card transition-transform hover:scale-105 ${
                    color === c
                      ? "border-ink ring-2 ring-[var(--accent-soft)]"
                      : "border-[var(--line)]"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {isManager && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={orgWide}
                onChange={(e) => setOrgWide(e.target.checked)}
              />
              Org-wide project (visible to all employees)
            </label>
          )}
        </div>
        {orgError && (
          <p className="mt-3 text-sm text-[var(--danger)]">{orgError}</p>
        )}
        <Button className="mt-4" size="sm" onClick={onCreate} loading={pending}>
          Create project
        </Button>
      </section>

      <ProjectSection
        title="Org-wide projects"
        projects={orgWideProjects}
        readOnly={!isManager}
        showOrgColumn={showOrgColumn}
        orgNameById={orgNameById}
        onArchive={(id) =>
          startTransition(async () => {
            const res = await archiveProject(id);
            toast(res.message, res.ok ? "success" : "error");
            if (res.ok) window.location.reload();
          })
        }
      />

      <ProjectSection
        title={isManager ? "Personal projects" : "Your personal projects"}
        projects={personalProjects}
        readOnly={false}
        showOrgColumn={showOrgColumn}
        orgNameById={orgNameById}
        onArchive={(id) =>
          startTransition(async () => {
            const res = await archiveProject(id);
            toast(res.message, res.ok ? "success" : "error");
            if (res.ok) window.location.reload();
          })
        }
      />
    </div>
  );
}

function ProjectSection({
  title,
  projects,
  readOnly,
  showOrgColumn,
  orgNameById,
  onArchive,
}: {
  title: string;
  projects: Project[];
  readOnly: boolean;
  showOrgColumn?: boolean;
  orgNameById?: Record<string, string>;
  onArchive: (id: string) => void;
}) {
  if (projects.length === 0) return null;
  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-card">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface-low p-4 shadow-card"
          >
            <span className="flex min-w-0 items-center gap-3 text-sm">
              <span
                className="inline-block h-4 w-4 shrink-0 rounded-full shadow-card"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{p.name}</span>
                {showOrgColumn && p.is_org_wide && orgNameById?.[p.org_id] && (
                  <span className="block truncate text-xs text-muted">
                    {orgNameById[p.org_id]}
                  </span>
                )}
              </span>
            </span>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onArchive(p.id)}>
                Archive
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
