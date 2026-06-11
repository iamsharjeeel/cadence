import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import {
  DocumentStatusPill,
  DocumentTypePill,
} from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Document, DocumentStatus, DocumentType, Profile } from "@/types/db";
import {
  DocumentFilters,
  DocumentStatusSelect,
  ResendEmailButton,
} from "./controls";

export const metadata: Metadata = { title: "Documents" };

type DocRow = Document & {
  timesheet: { period_start: string; period_end: string } | null;
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    status?: string;
    employee?: string;
    from?: string;
    to?: string;
  };
}) {
  const profile = await requireActiveProfile();
  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const isSuperadmin = profile.role === "superadmin";

  const db = isSuperadmin ? createAdminClient() : createClient();
  let query = db
    .from("documents")
    .select("*, timesheet:timesheets(period_start, period_end)")
    .order("created_at", { ascending: false });

  if (!isManager) query = query.eq("employee_id", profile.id);
  else if (!isSuperadmin) query = query.eq("org_id", profile.org_id!);

  if (searchParams.type) query = query.eq("type", searchParams.type);
  if (searchParams.status) query = query.eq("status", searchParams.status);
  if (isManager && searchParams.employee) {
    query = query.eq("employee_id", searchParams.employee);
  }
  if (searchParams.from) query = query.gte("created_at", searchParams.from);
  if (searchParams.to) {
    query = query.lte("created_at", `${searchParams.to}T23:59:59`);
  }

  const { data } = await query;
  const documents = (data ?? []) as DocRow[];

  const nameById = new Map<string, string>();
  let employeeOptions: { id: string; name: string }[] = [];
  if (isManager) {
    const pdb = isSuperadmin ? createAdminClient() : createClient();
    let pq = pdb.from("profiles").select("id, full_name, email");
    if (!isSuperadmin) pq = pq.eq("org_id", profile.org_id!);
    const { data: people } = await pq;
    for (const p of (people ?? []) as Pick<Profile, "id" | "full_name" | "email">[]) {
      const name = p.full_name?.trim() || p.email;
      nameById.set(p.id, name);
      employeeOptions.push({ id: p.id, name });
    }
    employeeOptions.sort((a, b) => a.name.localeCompare(b.name));
  }

  const adminDb = createAdminClient();
  const downloadUrls = new Map<string, string>();
  for (const doc of documents) {
    if (doc.file_path) {
      const { data: signed } = await adminDb.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 60 * 60);
      if (signed?.signedUrl) downloadUrls.set(doc.id, signed.signedUrl);
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description={
          isManager
            ? "Pay advices and invoices generated from approved timesheets."
            : "Your pay advices and invoices."
        }
        action={
          isManager ? (
            <Link href="/app/timesheets?status=approved">
              <Button size="sm" variant="secondary">
                Generate from timesheets
              </Button>
            </Link>
          ) : undefined
        }
      />

      {isManager && (
        <Card className="mb-4">
          <CardContent>
            <DocumentFilters
              type={searchParams.type ?? ""}
              status={searchParams.status ?? ""}
              employee={searchParams.employee ?? ""}
              employees={employeeOptions}
              from={searchParams.from ?? ""}
              to={searchParams.to ?? ""}
              isManager={isManager}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isManager ? "All documents" : "Your documents"}</CardTitle>
          <CardDescription>
            {documents.length}{" "}
            {documents.length === 1 ? "document" : "documents"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No documents yet"
                description="Generate a pay advice or invoice from an approved timesheet."
                action={
                  <Link href="/app/timesheets">
                    <Button size="sm">View timesheets</Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Type</TH>
                  <TH>Number</TH>
                  {isManager && <TH>Employee</TH>}
                  <TH>Period</TH>
                  <TH>Total</TH>
                  <TH>Status</TH>
                  <TH>Generated</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {documents.map((doc) => (
                  <TR key={doc.id}>
                    <TD>
                      <DocumentTypePill type={doc.type as DocumentType} />
                    </TD>
                    <TD className="tnum text-sm font-medium">{doc.document_number}</TD>
                    {isManager && (
                      <TD className="text-sm">
                        {nameById.get(doc.employee_id) ?? "—"}
                      </TD>
                    )}
                    <TD className="tnum text-sm text-muted">
                      {doc.timesheet
                        ? `${formatDate(doc.timesheet.period_start)} – ${formatDate(doc.timesheet.period_end)}`
                        : "—"}
                    </TD>
                    <TD className="tnum text-sm">
                      {formatMoney(doc.total, doc.currency)}
                    </TD>
                    <TD>
                      {isManager ? (
                        <DocumentStatusSelect
                          id={doc.id}
                          current={doc.status as DocumentStatus}
                        />
                      ) : (
                        <DocumentStatusPill status={doc.status as DocumentStatus} />
                      )}
                    </TD>
                    <TD className="tnum text-sm text-muted">
                      {formatDate(doc.created_at)}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2">
                        {downloadUrls.get(doc.id) && (
                          <a href={downloadUrls.get(doc.id)} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm">
                              Download
                            </Button>
                          </a>
                        )}
                        <ResendEmailButton id={doc.id} />
                      </div>
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
