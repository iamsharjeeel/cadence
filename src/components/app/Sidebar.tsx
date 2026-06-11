"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/utils";
import type { UserRole } from "@/types/db";
import { navForRole } from "./nav";
import { NavIcon } from "./NavIcon";

const MotionLink = motion(Link);

export function Sidebar({
  role,
  orgName,
}: {
  role: UserRole;
  orgName: string | null;
}) {
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-surface lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/app/dashboard">
          <Wordmark />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <MotionLink
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              whileHover={{ x: 2 }}
              transition={{ duration: 0.1 }}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-colors",
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

      <div className="border-t px-6 py-4">
        <p className="text-xs text-muted">Organization</p>
        <p className="truncate text-sm font-medium text-ink">
          {orgName ?? "—"}
        </p>
        <p className="mt-2 text-xs text-muted">{titleCase(role)}</p>
      </div>
    </aside>
  );
}
