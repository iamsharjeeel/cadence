"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { AsanaImportedProject } from "@/types/db";
import {
  archiveProject,
  createProject,
  updateProject,
  type ProjectListItem,
} from "./actions";
import { ProjectFormModal, type ProjectFormValues } from "./ProjectFormModal";

export function ProjectsManager({
  projects,
  asanaProjects = [],
  canCreate,
  inOrg,
}: {
  projects: ProjectListItem[];
  asanaProjects?: AsanaImportedProject[];
  canCreate: boolean;
  inOrg: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(
    null,
  );
  const [archiveTarget, setArchiveTarget] = useState<ProjectListItem | null>(
    null,
  );

  function refresh() {
    router.refresh();
  }

  function openCreate() {
    setModalMode("create");
    setEditingProject(null);
    setModalOpen(true);
  }

  function openEdit(project: ProjectListItem) {
    setModalMode("edit");
    setEditingProject(project);
    setModalOpen(true);
  }

  function handleSubmit(values: ProjectFormValues) {
    startTransition(async () => {
      const payload = {
        name: values.name,
        color: values.color,
        description: values.description,
        clientName: values.clientName,
        billableDefault: values.billableDefault,
      };

      const res =
        modalMode === "create"
          ? await createProject(payload)
          : await updateProject({
              id: editingProject!.id,
              ...payload,
            });

      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setModalOpen(false);
        setEditingProject(null);
        refresh();
      }
    });
  }

  function handleArchive(project: ProjectListItem) {
    setArchiveTarget(project);
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    const project = archiveTarget;
    startTransition(async () => {
      const res = await archiveProject(project.id);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setArchiveTarget(null);
        refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            New project
          </Button>
        </div>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to tag time entries."
          action={
            canCreate ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden />
                New project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-surface shadow-card">
          <ul className="divide-y divide-[var(--line)]">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-[var(--accent-soft)]/20 sm:px-5"
              >
                <span
                  className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-display text-sm font-semibold text-ink">
                      {project.name}
                    </span>
                    {project.client_name ? (
                      <span className="text-sm text-muted">
                        · {project.client_name}
                      </span>
                    ) : null}
                    {inOrg ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          project.scope === "org"
                            ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                            : "bg-surface-low text-muted",
                        )}
                      >
                        {project.scope === "org" ? "Org" : "Personal"}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        project.billable_default
                          ? "bg-[var(--accent-soft)]/60 text-[var(--accent-strong)]"
                          : "bg-surface-low text-muted",
                      )}
                    >
                      {project.billable_default ? "Billable" : "Non-billable"}
                    </span>
                  </div>
                  {project.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {project.description}
                    </p>
                  ) : null}
                </div>
                {project.canEdit ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(project)}
                      disabled={pending}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(project)}
                      disabled={pending}
                    >
                      Archive
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProjectFormModal
        open={modalOpen}
        mode={modalMode}
        project={editingProject}
        pending={pending}
        onClose={() => {
          if (!pending) {
            setModalOpen(false);
            setEditingProject(null);
          }
        }}
        onSubmit={handleSubmit}
      />

      <MotionModal
        open={archiveTarget !== null}
        onClose={() => !pending && setArchiveTarget(null)}
        panelClassName="max-w-md"
      >
        <h3 className="font-display text-[18px] font-semibold tracking-tightest text-ink">
          Archive this project?
        </h3>
        <p className="mt-2 font-body text-sm text-muted">
          {archiveTarget
            ? `"${archiveTarget.name}" will be hidden from time entry. You can restore it later from archived projects.`
            : null}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setArchiveTarget(null)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={pending}
            className="bg-[var(--danger)] text-white hover:opacity-90"
            onClick={() => void confirmArchive()}
          >
            Archive
          </Button>
        </div>
      </MotionModal>

      {asanaProjects.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <AsanaIcon size={16} />
            <span className="font-display text-sm font-semibold text-ink">
              Asana projects
            </span>
            <span className="text-xs text-muted">({asanaProjects.length})</span>
          </div>
          <p className="mb-3 text-sm text-muted">
            Imported from Asana — used for tagging time entries. Manage from your{" "}
            <a
              href="/app/user-settings#section-connected"
              className="underline hover:text-ink"
            >
              profile
            </a>
            .
          </p>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-surface shadow-card">
            <ul className="divide-y divide-[var(--line)]">
              {asanaProjects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <AsanaIcon size={14} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium text-ink">
                      {p.asana_project_name}
                    </span>
                    {p.asana_workspace_name && (
                      <span className="ml-2 text-xs text-muted">
                        · {p.asana_workspace_name}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
