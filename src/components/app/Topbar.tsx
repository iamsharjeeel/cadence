"use client";

import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { NavLink } from "@/components/app/NavLink";
import type { Profile } from "@/types/db";
import { navForRole } from "./nav";
import { NavIcon } from "./NavIcon";
import { useNavigation } from "./NavigationProvider";
import { usePathname } from "next/navigation";

export function Topbar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const { optimisticPath } = useNavigation();
  const [open, setOpen] = useState(false);
  const items = navForRole(profile.role);
  const currentPath = optimisticPath ?? pathname;
  const current = items.find((i) => i.href === currentPath);

  const linkClass =
    "flex items-center gap-3 rounded-[var(--radius-input)] border-l-2 border-transparent px-3 py-2.5 font-display text-sm font-medium min-h-11 dark:uppercase dark:tracking-[0.08em] dark:text-[11px] dark:font-semibold";
  const activeClass =
    "border-l-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] dark:bg-transparent dark:text-[var(--accent)]";
  const inactiveClass =
    "text-muted hover:bg-[var(--accent-soft)]/50 hover:text-ink dark:text-[var(--ink-muted)] dark:hover:bg-transparent dark:hover:text-[var(--ink)]";

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-[var(--line)] bg-surface dark:bg-[var(--background)] dark:border-[var(--line)]">
      <div className="flex h-14 items-center gap-3 px-5 sm:px-8">
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-input)] border border-[var(--line)] text-muted hover:text-ink lg:hidden"
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

        <h1 className="font-display text-base font-semibold tracking-tightest dark:uppercase dark:tracking-[0.06em] dark:text-[12px] dark:font-semibold dark:text-[var(--ink-muted)]">
          {current?.label ?? "Cadence"}
        </h1>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <NotificationsBell userId={profile.id} />
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar
              name={profile.full_name}
              email={profile.email}
              size={32}
            />
            <span className="max-w-[10rem] truncate text-sm text-ink">
              {profile.full_name ?? profile.email}
            </span>
          </div>
          <SignOutButton />
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--line)] px-3 py-3 lg:hidden">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={linkClass}
              activeClassName={activeClass}
              inactiveClassName={inactiveClass}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
