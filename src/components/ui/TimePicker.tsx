"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { fieldBase } from "@/components/ui/Input";

const PICKER_MOTION = {
  initial: { opacity: 0, y: 4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function normalizeTime(value: string): { hour: string; minute: string } {
  const [h = "09", m = "00"] = value.split(":");
  const hour = HOURS.includes(h.slice(0, 2).padStart(2, "0"))
    ? h.slice(0, 2).padStart(2, "0")
    : "09";
  const minute = MINUTES.includes(m.slice(0, 2).padStart(2, "0"))
    ? m.slice(0, 2).padStart(2, "0")
    : "00";
  return { hour, minute };
}

export function TimePicker({
  value,
  onChange,
  onBlur,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { hour, minute } = normalizeTime(value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        onBlur?.();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onBlur]);

  function setPart(part: "hour" | "minute", next: string) {
    const nextValue = part === "hour" ? `${next}:${minute}` : `${hour}:${next}`;
    onChange(nextValue);
  }

  function close() {
    setOpen(false);
    onBlur?.();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? "Select time"}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          fieldBase,
          "tabular flex h-9 w-[7.5rem] flex-none items-center justify-between gap-1 px-2.5 text-sm",
          className,
        )}
      >
        <span>{`${hour}:${minute}`}</span>
        <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Choose time"
            className="absolute left-0 top-full z-50 mt-1 flex overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-float"
            {...PICKER_MOTION}
          >
            <ScrollColumn
              label="Hour"
              options={HOURS}
              selected={hour}
              onSelect={(h) => setPart("hour", h)}
            />
            <div className="w-px bg-[var(--line)]" aria-hidden />
            <ScrollColumn
              label="Minute"
              options={MINUTES}
              selected={minute}
              onSelect={(m) => setPart("minute", m)}
            />
            <div className="border-l border-[var(--line)] p-2">
              <button
                type="button"
                onClick={close}
                className="rounded-[var(--radius-input)] bg-[var(--accent-mid)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-strong)]"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScrollColumn({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-value="${selected}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "center" });
    }
  }, [selected]);

  return (
    <div className="flex w-16 flex-col">
      <span className="border-b border-[var(--line)] px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <div ref={listRef} className="max-h-48 overflow-y-auto overscroll-contain py-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            data-value={opt}
            onClick={() => onSelect(opt)}
            className={cn(
              "tabular flex w-full items-center justify-center px-2 py-1.5 text-sm transition-colors",
              selected === opt
                ? "bg-[var(--accent-mid)] font-medium text-white"
                : "text-ink hover:bg-[var(--accent-soft)]",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
