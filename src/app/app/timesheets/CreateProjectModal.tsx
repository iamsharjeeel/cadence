"use client";

import { useState } from "react";

import { MotionModal } from "@/components/motion/MotionModal";
import { Button } from "@/components/ui/Button";
import { fieldBase } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { PROJECT_PRESET_COLORS } from "@/types/time-tracking";

export function CreateProjectModal({
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
    <MotionModal open={open} onClose={onClose} panelClassName="max-w-sm">
      <div>
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
