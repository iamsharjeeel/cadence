"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { assignOrgLibraryDocument } from "@/app/app/org-documents/actions";
import type { OrgLibraryDocument } from "@/lib/org-documents/queries";

export function AssignOrgDocumentModal({
  document,
  members,
  onClose,
}: {
  document: OrgLibraryDocument;
  members: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allSelected = members.length > 0 && selected.size === members.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(members.map((m) => m.id)));
  }

  async function submit() {
    if (selected.size === 0) {
      toast("Select at least one member.", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await assignOrgLibraryDocument(document.id, [...selected]);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <MotionModal open onClose={onClose} panelClassName="max-h-[90vh] max-w-lg overflow-y-auto">
      <h2 className="font-display text-lg font-semibold tracking-tightest">
        Assign document
      </h2>
      <p className="mt-1 text-sm text-muted">
        Assign <span className="font-medium text-ink">{document.name}</span> to
        team members. Each member receives their own copy to acknowledge.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--line)] bg-surface-low px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="font-medium">All members ({members.length})</span>
        </label>

        <div className="max-h-56 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--line)]">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 border-b border-[var(--line)] px-3 py-2.5 text-sm last:border-b-0 hover:bg-surface-low"
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span>{m.name}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <Button size="sm" loading={busy} onClick={submit}>
            Assign to {selected.size || "…"} member
            {selected.size === 1 ? "" : "s"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </MotionModal>
  );
}
