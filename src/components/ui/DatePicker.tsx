"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";
import { fieldBase } from "@/components/ui/Input";

const PICKER_MOTION = {
  initial: { opacity: 0, y: 4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d
    ? dt
    : null;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: startOffset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePicker({
  label,
  value,
  onChange,
  className,
  disabled,
  id,
  name,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}) {
  const autoId = useId();
  const inputId = id ?? name ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = parseIso(value);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? new Date().getMonth());

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value, selected]);

  const display = selected
    ? selected.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Select date";

  function pick(day: Date) {
    onChange(toIso(day));
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          fieldBase,
          "flex items-center justify-between gap-2 text-left",
          !value && "text-muted",
          className,
        )}
      >
        <span className="truncate">{display}</span>
        <Calendar className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
      </button>
      {name && <input type="hidden" name={name} value={value} />}

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Choose date"
            className="absolute left-0 top-full z-50 mt-1 w-[17.5rem] rounded-[var(--radius)] border bg-surface p-3 shadow-lift"
            {...PICKER_MOTION}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <span className="font-display text-sm font-semibold">{monthLabel}</span>
              <button
                type="button"
                aria-label="Next month"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <span
                  key={d}
                  className="text-center text-[10px] font-medium uppercase tracking-wide text-muted"
                >
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid(viewYear, viewMonth).map((day, i) => {
                if (!day) return <span key={`e-${i}`} />;
                const iso = toIso(day);
                const isSelected = value === iso;
                const isToday = iso === toIso(new Date());
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => pick(day)}
                    className={cn(
                      "tnum flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                      isSelected
                        ? "bg-[var(--accent)] text-white"
                        : "hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
                      isToday && !isSelected && "ring-1 ring-[var(--accent)]/40",
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
