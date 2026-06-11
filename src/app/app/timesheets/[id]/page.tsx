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
import { Badge, TimesheetStatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requireActiveProfile, hasRole } from "@/lib/auth";
import { GenerateDocumentButton } from "@/components/documents/GenerateDocumentButton";
import { ApprovalControls } from "./ApprovalControls";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import type {
  Profile,
  Timesheet,
  TimesheetRow,
  TimesheetStatus,
} from "@/types/db";

export const metadata: Metadata = { title: "Timesheet" };

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
    (profile.role === "admin" && timesheet.org_id === profile.org_id);
  if (!allowed) notFound();

  const [{ data: rowData }, { data: people }] = await Promise.all([
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
  ]);

  const rows = (rowData ?? []) as TimesheetRow[];
  const nameById = new Map<string, string>();
  for (const p of (people ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email"
  >[]) {
    nameById.set(p.id, p.full_name?.trim() || p.email);
  }

  const totalHours = rows.reduce((sum, r) => sum + Number(r.hours), 0);
  const status = timesheet.status as TimesheetStatus;
  const canApprove = hasRole(profile, ["admin", "superadmin"]);
  const canGenerateDoc =
    status === "approved" &&
    (timesheet.employee_id === profile.id || canApprove);

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
          <div className="flex flex-wrap gap-2">
            {canGenerateDoc && timesheet.calculated_total !== null && (
              <GenerateDocumentButton
                timesheetIds={[timesheet.id]}
                periodLabel={`${formatDate(timesheet.period_start)} – ${formatDate(timesheet.period_end)}`}
                subtotal={timesheet.calculated_total}
                currency={timesheet.currency_snapshot ?? "USD"}
              />
            )}
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

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Status
            </span>
            <TimesheetStatusPill status={status} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">
              Total hours
            </span>
            <span className="tnum text-lg font-semibold">
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
            <span className="tnum text-lg font-semibold">
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

      {status === "rejected" && timesheet.rejection_note && (
        <Card className="mb-4 border-[var(--danger)]">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--danger)]">
              Rejection note
            </span>
            <p className="text-sm text-ink">{timesheet.rejection_note}</p>
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
              <span className="tnum">
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
          <CardTitle>Rows</CardTitle>
          <CardDescription>
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
            {rawUrl && (
              <>
                {" · "}
                <a
                  href={rawUrl}
                  className="text-[var(--accent-strong)] underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download raw file
                </a>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TD className="tnum text-sm">{formatDate(r.row_date)}</TD>
                  <TD className="tnum text-sm">{r.hours}</TD>
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
