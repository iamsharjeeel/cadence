"use client";

import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { NavLink } from "@/components/app/NavLink";
import { titleCase } from "@/lib/utils";
import type { UserRole } from "@/types/db";
import { navForRole } from "./nav";
import { NavIcon } from "./NavIcon";

export function Sidebar({
  role,
  orgName,
  orgLogoUrl,
}: {
  role: UserRole;
  orgName: string | null;
  orgLogoUrl: string | null;
}) {
  const items = navForRole(role);

  const linkClass =
    "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-colors";
  const activeClass =
    "bg-[var(--accent-soft)] text-[var(--accent-strong)]";
  const inactiveClass = "text-muted hover:bg-[var(--line)] hover:text-ink";

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-surface lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/app/dashboard">
          <Wordmark />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            className={linkClass}
            activeClassName={activeClass}
            inactiveClassName={inactiveClass}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t px-6 py-4">
        <div className="flex items-center gap-3">
          {orgLogoUrl ? (
            <img
              src={orgLogoUrl}
              alt=""
              loading="lazy"
              className="h-8 w-8 shrink-0 rounded-lg border bg-[var(--line)] object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-strong)]">
              {orgName?.charAt(0)?.toUpperCase() ?? "—"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Organization</p>
            <p className="truncate text-sm font-medium text-ink">
              {orgName ?? "—"}
            </p>
            <p className="text-xs text-muted">{titleCase(role)}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
