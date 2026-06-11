"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { GenerateDocumentModal } from "./GenerateDocumentModal";

export function GenerateDocumentButton({
  timesheetIds,
  periodLabel,
  subtotal,
  currency,
  label = "Generate document",
  size = "sm" as const,
  variant = "secondary" as const,
}: {
  timesheetIds: string[];
  periodLabel: string;
  subtotal: number;
  currency: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  if (timesheetIds.length === 0) return null;

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <GenerateDocumentModal
          timesheetIds={timesheetIds}
          periodLabel={periodLabel}
          subtotal={subtotal}
          currency={currency}
          onClose={() => setOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </>
  );
}
