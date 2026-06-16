"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input, fieldBase } from "@/components/ui/Input";
import { MotionModal } from "@/components/motion/MotionModal";
import { cn } from "@/lib/utils";
import { PROJECT_PRESET_COLORS, type Project } from "@/types/time-tracking";

export type ProjectFormValues = {
  name: string;
  color: string;
  description: string;
  clientName: string;
  billableDefault: boolean;
};

const EMPTY_FORM: ProjectFormValues = {
  name: "",
  color: PROJECT_PRESET_COLORS[0],
  description: "",
  clientName: "",
  billableDefault: true,
};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function projectToForm(project: Project): ProjectFormValues {
  return {
    name: project.name,
    color: project.color,
    description: project.description ?? "",
    clientName: project.client_name ?? "",
    billableDefault: project.billable_default ?? true,
  };
}

export function ProjectFormModal({
  open,
  mode,
  project,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  project?: Project | null;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const [form, setForm] = useState<ProjectFormValues>(EMPTY_FORM);
  const selectedPreset = PROJECT_PRESET_COLORS.includes(
    form.color as (typeof PROJECT_PRESET_COLORS)[number],
  );
  const customColorValue = HEX_COLOR.test(form.color)
    ? form.color
    : PROJECT_PRESET_COLORS[0];

  useEffect(() => {
    if (!open) return;
    setForm(mode === "edit" && project ? projectToForm(project) : EMPTY_FORM);
  }, [open, mode, project]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <MotionModal
      open={open}
      onClose={() => !pending && onClose()}
      panelClassName="max-w-md"
    >
      <h2 className="font-display text-lg font-semibold tracking-tightest text-ink">
        {mode === "create" ? "New project" : "Edit project"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {mode === "create"
          ? "Add a project for time tracking."
          : "Update project details."}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
        <Input
          label="Name"
          name="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Website redesign"
          required
          maxLength={80}
          autoFocus
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Color</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={form.color === c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={cn(
                  "h-9 w-9 rounded-full border-2 shadow-card transition-transform hover:scale-105",
                  form.color === c
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent-soft)]"
                    : "border-[var(--line)]",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <label
              className={cn(
                "relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border-2 shadow-card transition-transform hover:scale-105",
                selectedPreset
                  ? "border-[var(--line)]"
                  : "border-[var(--accent)] ring-2 ring-[var(--accent-soft)]",
              )}
              aria-label="Choose custom project color"
              title="Custom color"
            >
              <span className="absolute inset-0" style={{ backgroundColor: customColorValue }} />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white mix-blend-difference">
                +
              </span>
              <input
                type="color"
                value={customColorValue}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="project-description" className="text-sm font-medium text-ink">
            Description
            <span className="ml-1 font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="project-description"
            name="description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
            maxLength={500}
            placeholder="Brief notes about this project"
            className={cn(fieldBase, "h-auto min-h-[5.5rem] resize-y py-2.5")}
          />
        </div>

        <Input
          label="Client name"
          name="client_name"
          value={form.clientName}
          onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
          placeholder="Acme Corp"
          maxLength={120}
        />

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-input)] border border-[var(--line)] bg-surface-low px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-ink">
              Billable by default
            </span>
            <span className="block text-xs text-muted">
              New time entries tagged to this project start billable
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={form.billableDefault}
            onClick={() =>
              setForm((f) => ({ ...f, billableDefault: !f.billableDefault }))
            }
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              form.billableDefault ? "bg-[var(--accent)]" : "bg-[var(--line)]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                form.billableDefault ? "left-[22px]" : "left-0.5",
              )}
            />
          </button>
        </label>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {mode === "create" ? "Create project" : "Save changes"}
          </Button>
        </div>
      </form>
    </MotionModal>
  );
}
