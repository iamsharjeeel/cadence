import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
import { DocumentsTabs } from "@/components/documents/DocumentsTabs";
import { GenerateFromTimesheetsButton } from "@/components/documents/GenerateFromTimesheetsButton";
import { PayDocumentRowActions } from "@/components/documents/PayDocumentRowActions";
import { UserDocumentsLibrary } from "@/components/documents/UserDocumentsLibrary";
import { OrgDocumentLibrary } from "@/components/documents/OrgDocumentLibrary";
import { MotionTR } from "@/components/motion/MotionTR";
import { getApprovedTimesheetsWithoutDocuments } from "@/lib/documents/queries";
import {
  listOrgLibraryDocuments,
  listAssignedOfficialDocumentsForMember,
  listOrgMembersForOfficialAssign,
  signedUrlsForOfficialDocuments,
} from "@/lib/org-documents/queries";
import {
  listUserDocumentsForOwner,
  signedUrlsForUserDocuments,
} from "@/lib/user-documents/queries";
import { getWorkspaceContext } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";
import type {
  Document,
  DocumentStatus,
  DocumentType,
  Profile,
} from "@/types/db";
import {
  DocumentFilters,
} from "./controls";

export const metadata: Metadata = { title: "Documents" };

type DocRow = Document & {
  timesheet: { period_start: string; period_end: string } | null;
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: {
    tab?: string;
    type?: string;
    status?: string;
    employee?: string;
    from?: string;
    to?: string;
    org?: string;
  };
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  const profile = ctx.effectiveProfile;
  const isSuperadmin = ctx.isSuperadmin;
  const isOrgManager =
    Boolean(ctx.activeOrgId) &&
    (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin");
  const isManager = isSuperadmin || isOrgManager;
  const tab = searchParams.tab ?? "pay";

  const adminDb = createAdminClient();
  const db = isSuperadmin ? adminDb : createClient();

  const nameById = new Map<string, string>();
  let employeeOptions: { id: string; name: string; org_id?: string }[] = [];
  let orgOptions: { id: string; name: string }[] = [];

  if (isManager) {
    let pq = adminDb.from("profiles").select("id, full_name, email, role, org_id");
    if (!isSuperadmin && ctx.activeOrgId) pq = pq.eq("org_id", ctx.activeOrgId);
    const { data: people } = await pq;
    for (const p of (people ?? []) as Pick<
      Profile,
      "id" | "full_name" | "email" | "role" | "org_id"
    >[]) {
      const name = p.full_name?.trim() || p.email;
      nameById.set(p.id, name);
      if (p.role === "employee") {
        employeeOptions.push({ id: p.id, name, org_id: p.org_id ?? undefined });
      }
    }
    employeeOptions.sort((a, b) => a.name.localeCompare(b.name));

    if (isSuperadmin) {
      const { data: orgs } = await adminDb
        .from("organizations")
        .select("id, name")
        .order("name");
      orgOptions = (orgs ?? []).map((o) => ({ id: o.id, name: o.name }));
    }
  }

  if (tab === "org") {
    const inOrg = Boolean(ctx.activeOrgId);
    const isOrgManager =
      inOrg &&
      (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin");

    if (!isOrgManager || !ctx.activeOrgId) {
      redirect("/app/documents?tab=official");
    }

    const [libraryDocs, members] = await Promise.all([
      listOrgLibraryDocuments(ctx.activeOrgId),
      listOrgMembersForOfficialAssign(ctx.activeOrgId),
    ]);

    return (
      <div>
        <PageHeader
          title="Documents"
          description="Organization document library — upload master documents and assign to members."
        />
        <DocumentsTabs tab={tab} showOrgLibrary />
        <OrgDocumentLibrary documents={libraryDocs} members={members} />
      </div>
    );
  }

  if (tab === "official") {
    const userId = ctx.effectiveProfile.id;
    const inOrg = Boolean(ctx.activeOrgId);
    const isOrgManager =
      inOrg &&
      (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin");
    const canUploadPersonal = !inOrg || ctx.isSuperadmin;

    const [documents, assignedOfficial] = await Promise.all([
      listUserDocumentsForOwner(userId),
      listAssignedOfficialDocumentsForMember(userId),
    ]);

    const [downloadUrls, officialDownloadUrls] = await Promise.all([
      signedUrlsForUserDocuments(documents),
      signedUrlsForOfficialDocuments(assignedOfficial),
    ]);

    return (
      <div>
        <PageHeader
          title="Documents"
          description="Pay documents and your official document library."
        />
        <DocumentsTabs tab={tab} showOrgLibrary={isOrgManager} />
        <UserDocumentsLibrary
          documents={documents}
          downloadUrls={downloadUrls}
          assignedOfficialDocs={assignedOfficial}
          officialDownloadUrls={officialDownloadUrls}
          canUploadPersonal={canUploadPersonal}
        />
      </div>
    );
  }

  let query = db
    .from("documents")
    .select("*, timesheet:timesheets(period_start, period_end)")
    .order("created_at", { ascending: false });

  if (!isManager) query = query.eq("employee_id", profile.id);
  else if (!isSuperadmin && ctx.activeOrgId) query = query.eq("org_id", ctx.activeOrgId);

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

  const pendingTimesheets = isManager
    ? await getApprovedTimesheetsWithoutDocuments(
        profile,
        isSuperadmin ? searchParams.org : undefined,
      )
    : [];

  const downloadUrls = new Map<string, string>();
  const documentsWithFiles = documents.filter(
    (doc): doc is DocRow & { file_path: string } => Boolean(doc.file_path),
  );
  if (documentsWithFiles.length > 0) {
    const { data: signedUrls } = await adminDb.storage
      .from("documents")
      .createSignedUrls(
        documentsWithFiles.map((doc) => doc.file_path),
        60 * 60,
      );
    const signedUrlByPath = new Map(
      (signedUrls ?? [])
        .filter(
          (signed): signed is typeof signed & { path: string; signedUrl: string } =>
            Boolean(signed.path && signed.signedUrl),
        )
        .map((signed) => [signed.path, signed.signedUrl]),
    );
    for (const doc of documentsWithFiles) {
      const signedUrl = signedUrlByPath.get(doc.file_path);
      if (signedUrl) downloadUrls.set(doc.id, signedUrl);
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description={
          isManager
            ? "Pay advices, invoices, and official documents."
            : "Your pay advices, invoices, and assigned documents."
        }
        action={
          isManager ? (
            <GenerateFromTimesheetsButton
              timesheets={pendingTimesheets}
              orgOptions={
                isSuperadmin
                  ? await adminDb
                      .from("organizations")
                      .select("id, name")
                      .then((r) =>
                        (r.data ?? []).map((o) => ({
                          id: o.id,
                          name: o.name,
                        })),
                      )
                  : undefined
              }
              selectedOrgId={searchParams.org}
            />
          ) : undefined
        }
      />

      <DocumentsTabs />

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
          <CardTitle>
            {isManager ? "Pay advices & invoices" : "Your documents"}
          </CardTitle>
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
            <Table className="[&_tbody_tr:nth-child(even)]:bg-surface-low/50">
              <THead className="bg-surface-low">
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
                {documents.map((doc, i) => (
                  <MotionTR key={doc.id} index={i}>
                    <TD>
                      <DocumentTypePill type={doc.type as DocumentType} />
                    </TD>
                    <TD className="tabular text-sm font-medium">
                      {doc.document_number}
                    </TD>
                    {isManager && (
                      <TD className="text-sm">
                        {nameById.get(doc.employee_id) ?? "—"}
                      </TD>
                    )}
                    <TD className="tabular text-sm text-muted">
                      {doc.timesheet
                        ? `${formatDate(doc.timesheet.period_start)} – ${formatDate(doc.timesheet.period_end)}`
                        : "—"}
                    </TD>
                    <TD className="tabular text-sm">
                      {formatMoney(doc.total, doc.currency)}
                    </TD>
                    <TD>
                      <DocumentStatusPill
                        status={doc.status as DocumentStatus}
                      />
                    </TD>
                    <TD className="tabular text-sm text-muted">
                      {formatDate(doc.created_at)}
                    </TD>
                    <TD>
                      {downloadUrls.get(doc.id) ? (
                        <PayDocumentRowActions
                          id={doc.id}
                          url={downloadUrls.get(doc.id)!}
                          filename={`${doc.document_number}.pdf`}
                          currentStatus={doc.status as DocumentStatus}
                          isManager={isManager}
                        />
                      ) : (
                        <span
                          className="text-sm text-muted"
                          title="Download link couldn't be generated — refresh to retry"
                        >
                          Unavailable
                        </span>
                      )}
                    </TD>
                  </MotionTR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
