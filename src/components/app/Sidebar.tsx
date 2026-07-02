"use client";

import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { NavLink } from "@/components/app/NavLink";
import { WorkspaceSwitcher } from "@/components/app/WorkspaceSwitcher";
import type { SwitcherData } from "@/components/app/AppShell";
import { navForContext, type NavContext } from "./nav";
import { NavIcon } from "./NavIcon";

export function Sidebar({
  navContext,
  switcher,
  mobileOpen = false,
  onMobileClose,
}: {
  navContext: NavContext;
  switcher: SwitcherData;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const items = navForContext(navContext);

  const linkClass =
    "flex items-center gap-3 rounded-[var(--radius-input)] border-l-2 border-transparent px-3 py-2.5 font-display text-sm font-medium transition-colors dark:uppercase dark:tracking-[0.08em] dark:text-[11px] dark:font-semibold";
  const activeClass =
    "border-l-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] dark:bg-transparent dark:text-[var(--accent)]";
  const inactiveClass =
    "text-muted hover:bg-[var(--accent-soft)]/50 hover:text-ink dark:text-[var(--ink-muted)] dark:hover:bg-transparent dark:hover:text-[var(--ink)]";

  const navContent = (
    <>
      <div className="border-b border-[var(--line)] px-6 py-5">
        <Link href="/app/dashboard" className="block" onClick={onMobileClose}>
          <Wordmark />
          <p className="mt-1 font-display text-[10px] uppercase tracking-widest text-muted">
            PAYROLL &amp; HR
          </p>
        </Link>
        <div className="mt-4">
          <WorkspaceSwitcher
            activeOrgId={switcher.activeOrgId}
            isSuperadmin={switcher.isSuperadmin}
            canCreateOrg={switcher.canCreateOrg}
            memberships={switcher.memberships}
            pendingInvites={switcher.pendingInvites}
            currentLabel={switcher.currentLabel}
            currentSublabel={switcher.currentSublabel}
            currentLogoName={switcher.currentLogoName}
            currentLogoUrl={switcher.currentLogoUrl}
            onNavigate={onMobileClose}
          />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            allNavHrefs={items.map((i) => i.href)}
            onClick={onMobileClose}
            className={linkClass}
            activeClassName={activeClass}
            inactiveClassName={inactiveClass}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--line)] bg-surface md:flex">
        {navContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
          />
          <aside className="relative flex h-full w-full max-w-xs flex-col border-r border-[var(--line)] bg-surface shadow-float">
            {navContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
