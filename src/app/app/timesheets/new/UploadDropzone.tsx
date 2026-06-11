"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import {
  ACCEPTED_EXTENSIONS,
  checkFile,
  parseFile,
} from "@/lib/timesheets/parse";
import type { RawTable } from "@/lib/timesheets/types";

export function UploadDropzone({
  onParsed,
  onError,
}: {
  onParsed: (table: RawTable, file: File) => void;
  onError: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // GSAP pulse while a file is dragged over the zone.
  useEffect(() => {
    if (prefersReducedMotion() || !zoneRef.current) return;
    if (dragging) {
      tweenRef.current = gsap.to(zoneRef.current, {
        scale: 1.01,
        duration: 0.7,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    } else {
      tweenRef.current?.kill();
      gsap.to(zoneRef.current, { scale: 1, duration: 0.2 });
    }
    return () => {
      tweenRef.current?.kill();
    };
  }, [dragging]);

  async function handleFile(file: File) {
    const check = checkFile(file);
    if (!check.ok) {
      onError(check.error);
      return;
    }
    try {
      const table = await parseFile(file, check.kind);
      if (table.headers.length === 0) {
        onError("That file appears to be empty.");
        return;
      }
      onParsed(table, file);
    } catch {
      onError("Couldn't parse that file.");
    }
  }

  return (
    <div
      ref={zoneRef}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border-2 border-dashed px-6 py-12 text-center transition-colors",
        dragging
          ? "border-accent bg-[var(--accent-soft)]"
          : "border-line hover:border-accent",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 16V4m0 0L8 8m4-4 4 4M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <p className="font-display text-base font-semibold tracking-tightest">
          Drag &amp; drop your timesheet
        </p>
        <p className="mt-1 text-sm text-muted">
          {ACCEPTED_EXTENSIONS.join(" or ")} · up to 10MB
        </p>
      </div>
      <label className="cursor-pointer text-sm font-medium text-[var(--accent-strong)] hover:underline">
        or browse files
        <input
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
