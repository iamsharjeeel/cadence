"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PROJECT_PRESET_COLORS, type Project } from "@/types/time-tracking";
import {
  archiveProject,
  createProject,
  updateProject,
} from "./actions";

export function ProjectsManager({
  projects,
  isManager,
  orgId,
}: {
  projects: Project[];
  isManager: boolean;
  orgId?: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROJECT_PRESET_COLORS[0]);
  const [orgWide, setOrgWide] = useState(false);

  const orgWideProjects = projects.filter((p) => p.is_org_wide);
  const personalProjects = projects.filter((p) => !p.is_org_wide);

  function onCreate() {
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
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[var(--radius)] border bg-surface p-6">
        <h3 className="font-display text-base font-medium">Create project</h3>
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
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 ${
                    color === c ? "border-ink" : "border-transparent"
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
        <Button className="mt-4" size="sm" onClick={onCreate} loading={pending}>
          Create project
        </Button>
      </section>

      <ProjectSection
        title="Org-wide projects"
        projects={orgWideProjects}
        readOnly={!isManager}
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
  onArchive,
}: {
  title: string;
  projects: Project[];
  readOnly: boolean;
  onArchive: (id: string) => void;
}) {
  if (projects.length === 0) return null;
  return (
    <section className="rounded-[var(--radius)] border bg-surface p-6">
      <h3 className="font-display text-base font-medium">{title}</h3>
      <ul className="mt-4 flex flex-col gap-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius)] border px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </span>
            {!readOnly && !p.is_org_wide && (
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
