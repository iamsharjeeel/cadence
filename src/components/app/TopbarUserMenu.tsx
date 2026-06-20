"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { DROPDOWN_PANEL } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/db";

const MENU_WIDTH = 176;

export function TopbarUserMenu({
  profile,
  avatarSrc,
}: {
  profile: Profile;
  avatarSrc: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
  }, []);

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

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-[9998] rounded-[var(--radius-card)] border border-[var(--line)] bg-surface py-1 shadow-card"
          {...DROPDOWN_PANEL}
        >
          <Link
            href="/app/profile"
            className="flex min-h-10 w-full items-center px-3 text-sm text-ink transition-colors hover:bg-[var(--accent-soft)]"
            onClick={() => setOpen(false)}
          >
            View profile
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex min-h-10 w-full items-center px-3 text-left text-sm text-ink transition-colors hover:bg-[var(--accent-soft)]"
            >
              Logout
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((v) => {
            if (!v) updatePosition();
            return !v;
          });
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-[var(--radius-input)] p-0.5 transition-colors",
          "hover:bg-[var(--accent-soft)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
        )}
      >
        <Avatar
          name={profile.full_name}
          email={profile.email}
          src={avatarSrc}
          size={32}
        />
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {mounted && createPortal(menu, document.body)}
    </>
  );
}
