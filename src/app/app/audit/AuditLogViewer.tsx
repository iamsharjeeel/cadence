"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { summarizePayload } from "@/lib/audit/summarize";
import { currentSearchParams } from "@/lib/search-params";
import type { AuditLogEntry } from "@/lib/audit/queries";
import { cn, titleCase } from "@/lib/utils";

function auditActionBadgeClass(action: string): string {
  const a = action.toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide dark:rounded-none";

  if (
    a === "created" ||
    a.includes("create") ||
    a.includes("invited") ||
    a === "approved"
  ) {
    return cn(
      base,
      "bg-[#E8F4EA] text-[#2D6A35] dark:border dark:border-[#3A6B2A] dark:bg-transparent dark:text-[#7DBF6A]",
    );
  }
  if (
    a.includes("delete") ||
    a.includes("removed") ||
    a.includes("cancelled") ||
    a === "rejected" ||
    a.includes("recalled")
  ) {
    return cn(
      base,
      "bg-[#FBE9E9] text-[#8B2020] dark:border dark:border-[#8B2020] dark:bg-transparent dark:text-[#E07070]",
    );
  }
  if (
    a.includes("submitted") ||
    a.includes("completed") ||
    a.includes("generated") ||
    a.includes("emailed") ||
    a.includes("signed") ||
    a.includes("acknowledged")
  ) {
    return cn(
      base,
      "bg-[var(--accent-soft)] text-[var(--accent)] dark:border dark:border-[var(--accent)] dark:bg-transparent dark:text-[var(--accent)]",
    );
  }
  if (a.includes("viewed") || a.includes("assigned")) {
    return cn(
      base,
      "bg-[var(--surface-low)] text-[var(--ink-muted)] dark:border dark:border-[var(--line)] dark:bg-transparent dark:text-[var(--ink-muted)]",
    );
  }
  if (
    a.includes("change") ||
    a.includes("update") ||
    a.includes("settings")
  ) {
    return cn(
      base,
      "bg-[#FFF8E6] text-[#8A6000] dark:border dark:border-[var(--accent)] dark:bg-transparent dark:text-[var(--accent)]",
    );
  }
  return cn(
    base,
    "bg-[var(--surface-low)] text-[var(--ink-muted)] dark:border dark:border-[var(--line)] dark:bg-transparent dark:text-[var(--ink-muted)]",
  );
}

function AuditActionBadge({ action }: { action: string }) {
  return (
    <span className={auditActionBadgeClass(action)}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

export type AuditFilters = {
  org: string;
  actor: string;
  action: string;
  entity: string;
  from: string;
  to: string;
};

export function AuditLogViewer({
  entries,
  hasMore,
  page,
  actors,
  actions,
  orgs,
  isSuperadmin,
  filters,
}: {
  entries: AuditLogEntry[];
  hasMore: boolean;
  page: number;
  actors: { id: string; full_name: string | null; email: string }[];
  actions: string[];
  orgs: { id: string; name: string }[];
  isSuperadmin: boolean;
  filters: AuditFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const [entityDraft, setEntityDraft] = useState(filters.entity);

  useEffect(() => {
    setEntityDraft(filters.entity);
  }, [filters.entity]);

  function currentParams(): URLSearchParams {
    return currentSearchParams(searchParams);
  }

  function updateFilter(key: string, value: string) {
    const next = currentParams();
    const trimmed = value.trim();
    if (trimmed) next.set(key, trimmed);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function applyEntityFilter() {
    updateFilter("entity", entityDraft);
  }

  async function exportCsv() {
    setExporting(true);
    const qs = currentParams().toString();
    window.location.href = `/api/audit/export${qs ? `?${qs}` : ""}`;
    setExporting(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {isSuperadmin && (
        <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-card">
          <div className="max-w-md">
            <Select
              label="Organization"
              value={filters.org}
              onChange={(e) => updateFilter("org", e.target.value)}
              options={[
                { label: "All organizations", value: "" },
                ...orgs.map((o) => ({ label: o.name, value: o.id })),
              ]}
            />
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Actor"
          value={filters.actor}
          onChange={(e) => updateFilter("actor", e.target.value)}
          options={[
            { label: "All actors", value: "" },
            ...actors.map((a) => ({
              label: a.full_name?.trim() || a.email,
              value: a.id,
            })),
          ]}
        />
        <Select
          label="Action"
          value={filters.action}
          onChange={(e) => updateFilter("action", e.target.value)}
          options={[
            { label: "All actions", value: "" },
            ...actions.map((a) => ({ label: a, value: a })),
          ]}
        />
        <div className="flex items-end gap-2">
          <Input
            label="Entity"
            value={entityDraft}
            onChange={(e) => setEntityDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyEntityFilter();
            }}
            placeholder="e.g. timesheets"
          />
          <Button variant="ghost" size="sm" onClick={applyEntityFilter}>
            Apply
          </Button>
        </div>
        <DatePicker
          label="From"
          value={filters.from}
          onChange={(v) => updateFilter("from", v)}
          className="h-9 text-sm"
        />
        <DatePicker
          label="To"
          value={filters.to}
          onChange={(v) => updateFilter("to", v)}
          className="h-9 text-sm"
        />
        <Button
          variant="secondary"
          size="sm"
          loading={exporting}
          onClick={exportCsv}
        >
          Export as CSV
        </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card dark:border dark:border-[var(--line)] dark:shadow-none">
        <Table>
          <THead className="[&_th]:text-[11px] [&_th]:tracking-[0.07em]">
            <TR>
              <TH>Timestamp</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Details</TH>
            </TR>
          </THead>
          <TBody>
            {entries.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-sm text-muted">
                  No audit entries match your filters.
                </TD>
              </TR>
            ) : (
              entries.map((entry) => (
                <TR
                  key={entry.id}
                  className=""
                >
                  <TD className="tabular whitespace-nowrap text-sm">
                    {new Date(entry.created_at).toLocaleString()}
                  </TD>
                  <TD className="text-sm">
                    {entry.actor ? (
                      <>
                        <span className="font-medium text-ink">
                          {entry.actor.full_name?.trim() || entry.actor.email}
                        </span>
                        {entry.actor.role ? (
                          <span className="ml-1 text-xs text-muted">
                            {titleCase(entry.actor.role)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-sm">
                    <AuditActionBadge action={entry.action} />
                  </TD>
                  <TD className="text-sm text-muted">{entry.entity ?? "—"}</TD>
                  <TD className="max-w-xs truncate text-sm text-muted">
                    {summarizePayload(entry.action, entry.payload)}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>

      {(hasMore || page > 0) && (
        <div className="flex justify-center gap-2">
          {page > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter("page", String(page - 1))}
            >
              Previous
            </Button>
          )}
          {hasMore && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateFilter("page", String(page + 1))}
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
