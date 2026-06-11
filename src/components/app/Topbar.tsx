"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/db";
import { navForRole } from "./nav";
import { NavIcon } from "./NavIcon";

const MotionLink = motion(Link);

export function Topbar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navForRole(profile.role);
  const current = items.find((i) => i.href === pathname);

  return (
    <header className="sticky top-0 z-20 border-b bg-bg/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-5 sm:px-8">
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border text-muted hover:text-ink lg:hidden"
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

        <h1 className="font-display text-base font-semibold tracking-tightest">
          {current?.label ?? "Cadence"}
        </h1>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
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
        <nav className="flex flex-col gap-1 border-t px-3 py-3 lg:hidden">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <MotionLink
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.1 }}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-muted hover:bg-[var(--line)] hover:text-ink",
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </MotionLink>
            );
          })}
        </nav>
      )}
    </header>
  );
}
