import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge, OvertimeBadge, TimesheetStatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requireActiveProfile, hasRole } from "@/lib/auth";
import { GenerateDocumentButton } from "@/components/documents/GenerateDocumentButton";
import { ApprovalControls } from "./ApprovalControls";
import { DeleteTimesheetControl } from "../DeleteTimesheetControl";
import { TimesheetStatusActions } from "../TimesheetStatusActions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApprovedLeaveInPeriod } from "@/lib/leave/queries";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import type {
  Profile,
  Timesheet,
  TimesheetRow,
  TimesheetStatus,
} from "@/types/db";
import type { TimeEntryWithProject } from "@/types/time-tracking";
import { durationHours } from "@/lib/time/validation";

export const metadata: Metadata = { title: "Timesheet" };

/** Correct hours for an entry — wraps overnight (the DB total_hours column is
 *  generated as (end - start)/3600 and goes negative for overnight ranges). */
function entryHours(e: TimeEntryWithProject): number {
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

export default async function TimesheetDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { data: ts } = await db
    .from("timesheets")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!ts) notFound();
  const timesheet = ts as Timesheet;

  // Authorize: owner, admin in same org, or any superadmin.
  const allowed =
    profile.role === "superadmin" ||
    timesheet.employee_id === profile.id ||
    (profile.role === "admin" &&
      profile.org_id != null &&
      timesheet.org_id === profile.org_id);
  if (!allowed) notFound();

  const [{ data: entryData }, { data: rowData }, { data: people }, { data: docRows }] = await Promise.all([
    db
      .from("time_entries")
      .select("*")
      .eq("timesheet_id", timesheet.id)
      .order("entry_date", { ascending: true })
      .order("start_time", { ascending: true }),
    db
      .from("timesheet_rows")
      .select("*")
      .eq("timesheet_id", timesheet.id)
      .order("row_date", { ascending: true }),
    db
      .from("profiles")
      .select("id, full_name, email")
      .in(
        "id",
        [timesheet.employee_id, timesheet.approved_by].filter(
          (v): v is string => !!v,
        ),
      ),
    db
      .from("documents")
      .select("id")
      .eq("timesheet_id", timesheet.id)
      .limit(1),
  ]);

  const rawEntries = entryData ?? [];
  const projectIds = [
    ...new Set(rawEntries.map((e) => e.project_id).filter(Boolean)),
  ] as string[];
  const { data: projectData } = projectIds.length
    ? await db.from("projects").select("id, name, color").in("id", projectIds)
    : { data: [] };
  const projectMap = new Map(
    (projectData ?? []).map((p) => [p.id, { id: p.id, name: p.name, color: p.color }]),
  );
  const entries: TimeEntryWithProject[] = rawEntries.map((e) => ({
    ...e,
    project: e.project_id ? projectMap.get(e.project_id) ?? null : null,
  }));
  const rows = (rowData ?? []) as TimesheetRow[];
  const nameById = new Map<string, string>();
  for (const p of (people ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email"
  >[]) {
    nameById.set(p.id, p.full_name?.trim() || p.email);
  }

  const status = timesheet.status as TimesheetStatus;
  const canApprove = hasRole(profile, ["admin", "superadmin"]);
  const totalHours =
    entries.length > 0
      ? Math.round(entries.reduce((sum, r) => sum + entryHours(r), 0) * 100) / 100
      : rows.reduce((sum, r) => sum + Number(r.hours), 0);
  const isReadOnlyAdmin =
    canApprove && timesheet.employee_id !== profile.id;
  const approvedLeaveDays = await getApprovedLeaveInPeriod(
    timesheet.employee_id,
    timesheet.period_start,
    timesheet.period_end,
    timesheet.org_id,
  );
  const canGenerateDoc =
    status === "approved" &&
    (timesheet.employee_id === profile.id || canApprove);
  const hasDocument = (docRows?.length ?? 0) > 0;
  const isOwner = timesheet.employee_id === profile.id;
  const canDelete =
    isOwner ||
    (profile.role === "admin" &&
      profile.org_id != null &&
      timesheet.org_id === profile.org_id) ||
    profile.role === "superadmin";

  // Signed URL for the raw artifact (1-hour expiry) — never a public URL.
  let rawUrl: string | null = null;
  if (timesheet.raw_file_path) {
    const { data: signed } = await db.storage
      .from("timesheets")
      .createSignedUrl(timesheet.raw_file_path, 60 * 60);
    rawUrl = signed?.signedUrl ?? null;
  }

  return (
    <div>
      <PageHeader
        title="Timesheet"
        description={`${formatDate(timesheet.period_start)} – ${formatDate(
          timesheet.period_end,
        )} · ${nameById.get(timesheet.employee_id) ?? ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canGenerateDoc && timesheet.calculated_total !== null && (
              <GenerateDocumentButton
                timesheetIds={[timesheet.id]}
                periodLabel={`${formatDate(timesheet.period_start)} – ${formatDate(timesheet.period_end)}`}
                subtotal={timesheet.calculated_total}
                currency={timesheet.currency_snapshot ?? "USD"}
              />
            )}
            <TimesheetStatusActions
              id={timesheet.id}
              status={status}
              periodStart={timesheet.period_start}
              periodEnd={timesheet.period_end}
              submittedAt={timesheet.submitted_at}
              editRequestStatus={timesheet.edit_request_status as "pending" | "approved" | "rejected" | null}
              isOwner={isOwner}
            />
            <DeleteTimesheetControl
              id={timesheet.id}
              status={status}
              canDelete={canDelete}
              hasDocument={hasDocument}
              redirectTo="/app/timesheets"
            />
            <Link href="/app/timesheets">
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
          </div>
        }
      />

      {canApprove && (
        <ApprovalControls
          timesheetId={timesheet.id}
          status={status}
        />
      )}

      {approvedLeaveDays > 0 && (
        <Card className="mb-4 border-[var(--accent)]">
          <CardContent className="py-4 text-sm text-ink">
            <span className="tabular font-semibold">{approvedLeaveDays}</span>{" "}
            day{approvedLeaveDays === 1 ? "" : "s"} of approved leave in this
            period.
          </CardContent>
        </Card>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Status
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <TimesheetStatusPill
                status={status}
                live={canApprove && status === "draft"}
              />
              {timesheet.has_overtime && timesheet.overtime_hours > 0 && (
                <OvertimeBadge hours={timesheet.overtime_hours} />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Total hours
            </span>
            <span className="tabular text-lg font-semibold">
              {totalHours.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Calculated total
            </span>
            <span className="tabular text-lg font-semibold">
              {status === "approved"
                ? formatMoney(
                    timesheet.calculated_total,
                    timesheet.currency_snapshot ?? "USD",
                  )
                : "—"}
            </span>
          </CardContent>
        </Card>
      </div>

      {status === "rejected" && (
        <Card className="mb-4 border-[var(--danger)]">
          <CardContent className="flex flex-col gap-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--danger)]">
                Rejected
              </span>
              {timesheet.rejection_note && (
                <p className="mt-1 text-sm text-ink">{timesheet.rejection_note}</p>
              )}
            </div>
            {isOwner && (
              <TimesheetStatusActions
                id={timesheet.id}
                status={status}
                periodStart={timesheet.period_start}
                periodEnd={timesheet.period_end}
                submittedAt={timesheet.submitted_at}
                editRequestStatus={timesheet.edit_request_status as "pending" | "approved" | "rejected" | null}
                isOwner={isOwner}
              />
            )}
          </CardContent>
        </Card>
      )}

      {status === "approved" && (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
            <Detail label="Approved by">
              {timesheet.approved_by
                ? nameById.get(timesheet.approved_by) ?? "—"
                : "—"}
            </Detail>
            <Detail label="Approved on">
              {formatDate(timesheet.approved_at)}
            </Detail>
            <Detail label="Rate snapshot">
              <span className="tabular">
                {formatMoney(
                  timesheet.rate_snapshot,
                  timesheet.currency_snapshot ?? "USD",
                )}
                {timesheet.rate_type_snapshot && (
                  <span className="ml-1 text-muted">
                    · {titleCase(timesheet.rate_type_snapshot)}
                  </span>
                )}
              </span>
            </Detail>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Time entries</CardTitle>
          <CardDescription>
            {entries.length || rows.length}{" "}
            {(entries.length || rows.length) === 1 ? "entry" : "entries"}
            {isReadOnlyAdmin && status === "draft" && " · Live view (read-only)"}
            {rawUrl && (
              <>
                {" · "}
                <a
                  href={rawUrl}
                  className="text-[var(--accent-strong)] underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download legacy raw file
                </a>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Start</TH>
                  <TH>End</TH>
                  <TH>Hours</TH>
                  <TH>Project</TH>
                  <TH>Description</TH>
                  <TH>Billable</TH>
                </TR>
              </THead>
              <TBody>
                {entries.map((r) => (
                  <TR key={r.id}>
                    <TD className="tabular text-sm">{formatDate(r.entry_date)}</TD>
                    <TD className="tabular text-sm">{String(r.start_time).slice(0, 5)}</TD>
                    <TD className="tabular text-sm">{String(r.end_time).slice(0, 5)}</TD>
                    <TD className="tabular text-sm">{entryHours(r)}</TD>
                    <TD className="text-sm">
                      {r.project?.name ?? "—"}
                    </TD>
                    <TD className="text-sm text-muted">{r.description ?? "—"}</TD>
                    <TD>
                      {r.billable ? (
                        <Badge tone="accent">Billable</Badge>
                      ) : (
                        <Badge tone="muted">Non-billable</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Hours</TH>
                  <TH>Project</TH>
                  <TH>Description</TH>
                  <TH>Billable</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="tabular text-sm">{formatDate(r.row_date)}</TD>
                    <TD className="tabular text-sm">{r.hours}</TD>
                    <TD className="text-sm">{r.project ?? "—"}</TD>
                    <TD className="text-sm text-muted">{r.description ?? "—"}</TD>
                    <TD>
                      {r.billable ? (
                        <Badge tone="accent">Billable</Badge>
                      ) : (
                        <Badge tone="muted">Non-billable</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}
