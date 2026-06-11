"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { DROPDOWN_PANEL } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type RowAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  download?: string;
  target?: string;
  destructive?: boolean;
  hidden?: boolean;
};

export function RowActionsMenu({
  actions,
  align = "right",
}: {
  actions: RowAction[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = actions.filter((a) => !a.hidden);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Row actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-9 px-0"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={cn(
              "absolute top-full z-30 mt-1 min-w-[10rem] rounded-[var(--radius)] border bg-surface py-1 shadow-card",
              align === "right" ? "right-0" : "left-0",
            )}
            {...DROPDOWN_PANEL}
          >
            {visible.map((action) => {
              const className = cn(
                "flex min-h-10 w-full items-center px-3 text-left text-sm hover:bg-[var(--accent-soft)]",
                action.destructive && "text-[var(--danger)]",
              );
              if (action.href) {
                return (
                  <a
                    key={action.label}
                    href={action.href}
                    target={action.target}
                    rel={action.target === "_blank" ? "noreferrer" : undefined}
                    download={action.download}
                    className={className}
                    onClick={() => setOpen(false)}
                  >
                    {action.label}
                  </a>
                );
              }
              return (
                <button
                  key={action.label}
                  type="button"
                  className={className}
                  onClick={() => {
                    action.onClick?.();
                    setOpen(false);
                  }}
                >
                  {action.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
