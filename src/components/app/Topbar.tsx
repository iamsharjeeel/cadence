"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { useNavigation } from "./NavigationProvider";
import type { Profile } from "@/types/db";
import { navForContext, type NavContext } from "./nav";
import { usePathname } from "next/navigation";

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
          <Avatar
            name={profile.full_name}
            email={profile.email}
            size={32}
          />
          <span className="hidden max-w-[10rem] truncate text-sm text-ink sm:inline">
            {profile.full_name ?? profile.email}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
