"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { MotionTR } from "@/components/motion/MotionTR";
import { summarizePayload } from "@/lib/audit/summarize";
import type { AuditLogEntry } from "@/lib/audit/queries";
import { formatDate, titleCase } from "@/lib/utils";

export function AuditLogViewer({
  entries,
  hasMore,
  page,
  actors,
  actions,
  orgs,
  isSuperadmin,
  selectedOrgId,
}: {
  entries: AuditLogEntry[];
  hasMore: boolean;
  page: number;
  actors: { id: string; full_name: string | null; email: string }[];
  actions: string[];
  orgs: { id: string; name: string }[];
  isSuperadmin: boolean;
  selectedOrgId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [exporting, setExporting] = useState(false);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  async function exportCsv() {
    setExporting(true);
    const qs = params.toString();
    window.location.href = `/api/audit/export${qs ? `?${qs}` : ""}`;
    setExporting(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {isSuperadmin && (
        <div className="max-w-md">
          <Select
            label="Organization"
            value={selectedOrgId}
            onChange={(e) => updateFilter("org", e.target.value)}
            options={[
              { label: "All organizations", value: "" },
              ...orgs.map((o) => ({ label: o.name, value: o.id })),
            ]}
          />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Actor"
          value={params.get("actor") ?? ""}
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
          value={params.get("action") ?? ""}
          onChange={(e) => updateFilter("action", e.target.value)}
          options={[
            { label: "All actions", value: "" },
            ...actions.map((a) => ({ label: a, value: a })),
          ]}
        />
        <Input
          label="Entity"
          value={params.get("entity") ?? ""}
          onChange={(e) => updateFilter("entity", e.target.value)}
          placeholder="e.g. timesheets"
        />
        <Input
          label="From"
          type="date"
          value={params.get("from") ?? ""}
          onChange={(e) => updateFilter("from", e.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={params.get("to") ?? ""}
          onChange={(e) => updateFilter("to", e.target.value)}
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

      <div className="overflow-hidden rounded-[var(--radius)] border bg-surface">
        <Table>
          <THead>
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
              entries.map((entry, i) => (
                <MotionTR key={entry.id} index={i}>
                  <TD className="tnum whitespace-nowrap text-sm">
                    {new Date(entry.created_at).toLocaleString()}
                  </TD>
                  <TD className="text-sm">
                    {entry.actor ? (
                      <>
                        <span className="font-medium text-ink">
                          {entry.actor.full_name?.trim() || entry.actor.email}
                        </span>
                        <span className="ml-1 text-xs text-muted">
                          {titleCase(entry.actor.role)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-sm">{entry.action}</TD>
                  <TD className="text-sm text-muted">{entry.entity ?? "—"}</TD>
                  <TD className="max-w-xs truncate text-sm text-muted">
                    {summarizePayload(entry.action, entry.payload)}
                  </TD>
                </MotionTR>
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
