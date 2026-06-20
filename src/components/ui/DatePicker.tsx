"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const POPOVER_WIDTH = 280; // 17.5rem
const POPOVER_HEIGHT_ESTIMATE = 320;

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
  minDate,
  maxDate,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  /** Earliest selectable date (inclusive), ISO `YYYY-MM-DD`. */
  minDate?: string;
  /** Latest selectable date (inclusive), ISO `YYYY-MM-DD`. Pass today to block future dates. */
  maxDate?: string;
}) {
  const autoId = useId();
  const inputId = id ?? name ?? autoId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const selected = parseIso(value);
  const [viewYear, setViewYear] = useState(
    selected?.getFullYear() ?? new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    selected?.getMonth() ?? new Date().getMonth(),
  );

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp =
      spaceBelow < POPOVER_HEIGHT_ESTIMATE + 8 && rect.top > POPOVER_HEIGHT_ESTIMATE;
    const top = openUp
      ? rect.top - POPOVER_HEIGHT_ESTIMATE - 4
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - POPOVER_WIDTH - 8,
    );
    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Sync the visible month to the selected date (or today) only when the
  // picker opens. Deriving the visible month from the value on every render
  // (via an effect keyed on the parsed Date) re-locks the calendar to the
  // selected month after each render — which makes prev/next navigation and
  // cross-month reselection impossible once a date has been chosen.
  function openPicker() {
    const base = parseIso(value) ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    updatePosition();
    setOpen(true);
  }

  const display = selected
    ? selected.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Select date";

  const minIso = minDate && parseIso(minDate) ? minDate : null;
  const maxIso = maxDate && parseIso(maxDate) ? maxDate : null;

  function isOutOfRange(iso: string): boolean {
    if (minIso && iso < minIso) return true;
    if (maxIso && iso > maxIso) return true;
    return false;
  }

  function pick(day: Date) {
    const iso = toIso(day);
    if (isOutOfRange(iso)) return;
    onChange(iso);
    setOpen(false);
  }

  function shiftMonth(delta: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const popover = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          role="dialog"
          aria-label="Choose date"
          style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
          className="fixed z-[9998] rounded-[var(--radius-card)] bg-surface p-3 shadow-float"
          {...PICKER_MOTION}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              onClick={(e) => shiftMonth(-1, e)}
            >
              ‹
            </button>
            <span className="font-display text-sm font-semibold">{monthLabel}</span>
            <button
              type="button"
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              onClick={(e) => shiftMonth(1, e)}
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
              const outOfRange = isOutOfRange(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={outOfRange}
                  aria-disabled={outOfRange}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pick(day);
                  }}
                  className={cn(
                    "tabular flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                    outOfRange
                      ? "cursor-not-allowed text-muted opacity-40"
                      : isSelected
                        ? "bg-[var(--accent-mid)] text-white"
                        : "hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
                    isToday &&
                      !isSelected &&
                      !outOfRange &&
                      "ring-1 ring-[var(--accent)]",
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
  );

  return (
    <div className="relative flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          if (disabled) return;
          if (open) {
            setOpen(false);
          } else {
            openPicker();
          }
        }}
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
      {mounted && createPortal(popover, document.body)}
    </div>
  );
}
