"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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

const MENU_HEIGHT_ESTIMATE = 44;

export function RowActionsMenu({
  actions,
  align = "right",
}: {
  actions: RowAction[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, openUp: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visible = actions.filter((a) => !a.hidden);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = Math.min(
      visible.length * MENU_HEIGHT_ESTIMATE + 8,
      320,
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 8 && rect.top > menuHeight;
    const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const left = align === "right" ? rect.right - 160 : rect.left;
    setPosition({ top, left: Math.max(8, left), openUp });
  }, [align, visible.length]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onScroll() {
      updatePosition();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  if (visible.length === 0) return null;

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[9998] min-w-[10rem] rounded-[var(--radius-card)] border bg-surface py-1 shadow-card"
          {...DROPDOWN_PANEL}
        >
          {visible.map((action) => {
            const className = cn(
              "flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-[var(--accent-soft)]",
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
  );

  return (
    <div className="relative flex justify-end">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        aria-label="Row actions"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => {
            if (!v) updatePosition();
            return !v;
          });
        }}
        className="h-11 w-11 px-0"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {mounted && createPortal(menu, document.body)}
    </div>
  );
}
