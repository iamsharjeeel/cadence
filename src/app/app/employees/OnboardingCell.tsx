"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

const STEP_LABELS: Record<string, string> = {
  personal: "Personal details",
  employment: "Employment",
  banking: "Banking & tax",
  emergency: "Emergency contact",
  documents: "Documents",
  complete: "Complete",
};

export function OnboardingCell({
  label,
  steps,
}: {
  label: string;
  steps: { step: string; completed_at: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const done = new Set(
    steps.filter((s) => s.completed_at).map((s) => s.step),
  );

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[var(--radius-card)] border bg-surface p-6 shadow-card">
            <h3 className="text-lg font-semibold">Onboarding progress</h3>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {Object.entries(STEP_LABELS).map(([key, name]) => {
                const row = steps.find((s) => s.step === key);
                const complete = !!row?.completed_at;
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className={complete ? "text-ink" : "text-muted"}>
                      {name}
                    </span>
                    <span className="text-xs text-muted">
                      {complete ? formatDate(row!.completed_at!) : "Pending"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Button
              className="mt-6"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
