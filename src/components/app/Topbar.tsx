"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, User } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Wordmark } from "@/components/brand/Wordmark";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { useNavigation } from "./NavigationProvider";
import type { Profile } from "@/types/db";
import { navForContext, type NavContext } from "./nav";
import { usePathname } from "next/navigation";

function AvatarDropdown({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-[var(--radius-input)] p-1 transition-colors hover:bg-[var(--accent-soft)]/40"
      >
        {resolveAvatarUrl(profile.avatar_url) ? (
          <span className="relative inline-block h-8 w-8 overflow-hidden rounded-full ring-1 ring-[var(--line)]">
            <Image
              src={resolveAvatarUrl(profile.avatar_url)!}
              alt={profile.full_name ?? profile.email}
              fill
              className="object-cover"
              unoptimized
            />
          </span>
        ) : (
          <Avatar name={profile.full_name} email={profile.email} size={32} />
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-surface shadow-card"
          >
            <Link
              href="/app/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink transition-colors hover:bg-[var(--accent-soft)]/40"
            >
              <User className="h-4 w-4 text-muted" aria-hidden />
              View profile
            </Link>
            <form action="/auth/signout" method="post" className="border-t border-[var(--line)]">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink transition-colors hover:bg-[var(--accent-soft)]/40"
              >
                <LogOut className="h-4 w-4 text-muted" aria-hidden />
                Logout
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Topbar({
  profile,
  navContext,
  mobileNavOpen,
  onMobileNavToggle,
}: {
  profile: Profile;
  navContext: NavContext;
  mobileNavOpen?: boolean;
  onMobileNavToggle?: () => void;
}) {
  const pathname = usePathname();
  const { optimisticPath } = useNavigation();
  const items = navForContext(navContext);
  const currentPath = optimisticPath ?? pathname;
  const current = items.find((i) => i.href === currentPath);

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-[var(--line)] bg-surface dark:bg-[var(--background)] dark:border-[var(--line)]">
      <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-3 px-5 sm:px-8">
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileNavOpen}
          onClick={onMobileNavToggle}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-input)] border border-[var(--line)] text-muted hover:text-ink md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="flex justify-center md:justify-start">
          <div className="md:hidden">
            <Wordmark />
          </div>
          <h1 className="hidden font-display text-base font-semibold tracking-tightest text-ink md:block dark:uppercase dark:tracking-[0.06em] dark:text-[12px] dark:font-semibold dark:text-[var(--ink-muted)]">
            {current?.label ?? "Cadence"}
          </h1>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <ThemeToggle />
          <NotificationsBell userId={profile.id} />
          <AvatarDropdown profile={profile} />
        </div>
      </div>
    </header>
  );
}
