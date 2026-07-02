import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AsanaIcon } from "@/components/icons/AsanaIcon";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { fetchProjectsForTimeEntry } from "@/app/app/projects/actions";
import { resolveReportRange } from "@/lib/reports/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { durationHours } from "@/lib/time/validation";
import { getWorkspaceContext } from "@/lib/workspace";
import type { AsanaImportedProject, TimeEntry } from "@/types/db";
import { TimeTrackedFilters, type TimeWindowPreset } from "./TimeTrackedFilters";

export const metadata: Metadata = { title: "Time tracked" };

type EntryRow = Pick<
  TimeEntry,
  | "id"
  | "project_id"
  | "asana_project_id"
  | "entry_date"
  | "start_time"
  | "end_time"
  | "total_hours"
  | "decimal_hours"
  | "description"
  | "billable"
  | "status"
  | "created_at"
  | "entry_mode"
>;

/** Correct hours — wraps overnight (DB total_hours goes negative). */
function entryHours(e: EntryRow): number {
  if (e.entry_mode === "decimal_hours" && e.decimal_hours != null) {
    return Number(e.decimal_hours);
  }
  return (
    durationHours(
      String(e.start_time).slice(0, 5),
      String(e.end_time).slice(0, 5),
    ) ?? Number(e.total_hours)
  );
}

function formatDuration(totalHours: number): string {
  if (!Number.isFinite(totalHours) || totalHours <= 0) return "—";
  const totalMinutes = Math.round(totalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDateTime(date: string, time: string): string {
  const dt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(dt.getTime())) return `${date} ${time}`;
  return dt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function TimeTrackedPage({
  searchParams,
}: {
  searchParams: {
    window?: string;
    project?: string;
    from?: string;
    to?: string;
  };
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const preset = (searchParams.window === "custom" ||
  searchParams.window === "this_month"
    ? searchParams.window
    : "this_week") as TimeWindowPreset;

  const range = resolveReportRange(
    preset,
    searchParams.from,
    searchParams.to,
  );

  const projectFilter = searchParams.project ?? "";
  const db = createAdminClient();
  const userId = ctx.realProfile.id;
  const activeOrgId = ctx.activeOrgId;

  let entryQuery = db
    .from("time_entries")
    .select(
      "id, project_id, asana_project_id, entry_date, start_time, end_time, total_hours, decimal_hours, description, billable, status, created_at, entry_mode",
    )
    .eq("employee_id", userId)
    .gte("entry_date", range.from)
    .lte("entry_date", range.to)
    .order("entry_date", { ascending: false })
    .order("start_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  entryQuery = activeOrgId
    ? entryQuery.eq("org_id", activeOrgId)
    : entryQuery.is("org_id", null);

  if (projectFilter === "__none__") {
    entryQuery = entryQuery.is("project_id", null);
  } else if (projectFilter) {
    entryQuery = entryQuery.eq("project_id", projectFilter);
  }

  const [{ data: entriesData }, cadenceProjects] = await Promise.all([
    entryQuery,
    fetchProjectsForTimeEntry(activeOrgId, userId),
  ]);

  const entries = (entriesData ?? []) as EntryRow[];
  const projectIds = [
    ...new Set(entries.map((entry) => entry.project_id).filter(Boolean)),
  ] as string[];
  const asanaIds = [
    ...new Set(entries.map((entry) => entry.asana_project_id).filter(Boolean)),
  ] as string[];

  const [projectMeta, asanaMeta] = await Promise.all([
    projectIds.length
      ? db
          .from("projects")
          .select("id, name, color")
          .in("id", projectIds)
      : Promise.resolve({
          data: [] as { id: string; name: string; color: string }[],
        }),
    asanaIds.length
      ? db
          .from("asana_imported_projects")
          .select("id, asana_project_name")
          .in("id", asanaIds)
      : Promise.resolve({
          data: [] as Pick<AsanaImportedProject, "id" | "asana_project_name">[],
        }),
  ]);

  const projectById = new Map(
    (projectMeta.data ?? []).map((project) => [project.id, project]),
  );
  const asanaById = new Map(
    (asanaMeta.data ?? []).map((project) => [project.id, project]),
  );

  return (
    <div>
      <PageHeader
        title="Time tracked"
        description="History of all logged time entries in this workspace."
      />

      <Card className="mb-4">
        <CardContent>
          <TimeTrackedFilters
            preset={preset}
            project={projectFilter}
            from={range.from}
            to={range.to}
            projects={cadenceProjects.map((project) => ({
              id: project.id,
              name: project.name,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logged entries</CardTitle>
          <CardDescription>
            {entries.length} {entries.length === 1 ? "entry" : "entries"} ·{" "}
            {range.from} to {range.to}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {entries.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No logged time yet"
                description="Log time on your timesheet to build your history here."
              />
            </div>
          ) : (
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Project</TH>
                  <TH>Duration</TH>
                  <TH>Started</TH>
                  <TH>Ended</TH>
                  <TH>Status</TH>
                  <TH>Notes</TH>
                </TR>
              </THead>
              <TBody>
                {entries.map((entry) => {
                  const cadenceProject = entry.project_id
                    ? (projectById.get(entry.project_id) ?? null)
                    : null;
                  const asanaProject = entry.asana_project_id
                    ? (asanaById.get(entry.asana_project_id) ?? null)
                    : null;
                  const projectName =
                    cadenceProject?.name ??
                    asanaProject?.asana_project_name ??
                    "No project";

                  return (
                    <TR key={entry.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          {entry.project_id && cadenceProject?.color ? (
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: cadenceProject.color }}
                              aria-hidden
                            />
                          ) : null}
                          {entry.asana_project_id ? (
                            <AsanaIcon size={13} />
                          ) : null}
                          {entry.project_id || entry.asana_project_id ? (
                            <Link
                              href="/app/projects"
                              className="font-medium text-ink hover:text-[var(--accent-strong)]"
                            >
                              {projectName}
                            </Link>
                          ) : (
                            <span className="text-muted">{projectName}</span>
                          )}
                        </div>
                      </TD>
                      <TD className="tabular">
                        {formatDuration(entryHours(entry))}
                      </TD>
                      <TD>
                        {entry.entry_mode === "decimal_hours" ? (
                          <span className="text-muted">
                            {new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString(
                              undefined,
                              { dateStyle: "medium" },
                            )}
                          </span>
                        ) : (
                          formatDateTime(
                            entry.entry_date,
                            String(entry.start_time).slice(0, 5),
                          )
                        )}
                      </TD>
                      <TD>
                        {entry.entry_mode === "decimal_hours" ? (
                          <span className="text-muted">—</span>
                        ) : (
                          formatDateTime(
                            entry.entry_date,
                            String(entry.end_time).slice(0, 5),
                          )
                        )}
                      </TD>
                      <TD>
                        {entry.status === "pending_approval" ? (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                            Pending
                          </span>
                        ) : entry.status === "approved" ? (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                            Approved
                          </span>
                        ) : entry.status ? (
                          <span className="rounded-full bg-[var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                            {entry.status.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                            Logged
                          </span>
                        )}
                      </TD>
                      <TD className="max-w-[300px] truncate text-muted">
                        {entry.description?.trim() || "—"}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
