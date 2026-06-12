"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";

export function ExportButton() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);

  function download() {
    if (!from || !to) return;
    const url = `/api/timesheets/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    window.location.href = url;
    setOpen(false);
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Export CSV
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <DatePicker
        label="From"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="h-9 w-40 text-sm"
      />
      <DatePicker
        label="To"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="h-9 w-40 text-sm"
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={download}
        disabled={!from || !to}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Download
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
