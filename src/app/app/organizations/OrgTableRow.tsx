"use client";

import { useRouter } from "next/navigation";

import { TR, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { formatDate, titleCase } from "@/lib/utils";
import type { Organization } from "@/types/db";

export function OrgTableRow({ org }: { org: Organization }) {
  const router = useRouter();
  const href = `/app/orgs/${org.slug}/dashboard`;

  return (
    <TR
      className="cursor-pointer transition-colors hover:bg-[var(--accent-soft)]/30"
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open ${org.name} dashboard`}
    >
      <TD>
        <p className="text-sm font-medium text-ink">{org.name}</p>
        <p className="text-xs text-muted">
          /{org.slug} · {org.base_currency}
        </p>
      </TD>
      <TD>
        {org.allowed_domains.length === 0 ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {org.allowed_domains.map((d) => (
              <Badge key={d} tone="accent">
                {d}
              </Badge>
            ))}
          </div>
        )}
      </TD>
      <TD className="text-sm text-muted">{titleCase(org.default_cadence)}</TD>
      <TD className="tnum text-sm text-muted">{formatDate(org.created_at)}</TD>
    </TR>
  );
}
