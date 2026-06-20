"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { MotionTR } from "@/components/motion/MotionTR";
import { formatDate } from "@/lib/utils";
import type { OfficialDocument, UserDocument } from "@/types/db";
import { UploadUserDocumentModal } from "./UploadUserDocumentModal";
import { UserDocumentRowActions } from "./UserDocumentRowActions";
import { OrgAssignedDocumentRowActions } from "./OrgAssignedDocumentRowActions";

type OfficialRow = {
  kind: "official";
  doc: OfficialDocument;
  signedUrl?: string;
};

type PersonalRow = {
  kind: "personal";
  doc: UserDocument;
  signedUrl?: string;
};

function statusLabel(status: string) {
  if (status === "pending") return "Pending acknowledgement";
  if (status === "acknowledged") return "Acknowledged";
  return status.replace(/_/g, " ");
}

export function UserDocumentsLibrary({
  documents,
  downloadUrls,
  assignedOfficialDocs,
  officialDownloadUrls,
  canUploadPersonal,
}: {
  documents: UserDocument[];
  downloadUrls: Record<string, string>;
  assignedOfficialDocs: OfficialDocument[];
  officialDownloadUrls: Record<string, string>;
  canUploadPersonal: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);

  const rows: Array<PersonalRow | OfficialRow> = [
    ...assignedOfficialDocs.map((doc) => ({
      kind: "official" as const,
      doc,
      signedUrl: officialDownloadUrls[doc.id],
    })),
    ...documents.map((doc) => ({
      kind: "personal" as const,
      doc,
      signedUrl: downloadUrls[doc.id],
    })),
  ].sort((a, b) => {
    const aDate =
      a.kind === "official" ? a.doc.created_at : a.doc.created_at;
    const bDate =
      b.kind === "official" ? b.doc.created_at : b.doc.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  const hasRows = rows.length > 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Official documents</CardTitle>
            <CardDescription>
              Your personal uploads and documents assigned by your organization.
            </CardDescription>
          </div>
          {canUploadPersonal && hasRows ? (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              Upload document
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {!hasRows ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No documents yet"
                description={
                  canUploadPersonal
                    ? "Upload files to your personal library, or wait for org-assigned documents."
                    : "Documents assigned to you will appear here."
                }
                action={
                  canUploadPersonal ? (
                    <Button size="sm" onClick={() => setUploadOpen(true)}>
                      Upload document
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <Table className="[&_tbody_tr:nth-child(even)]:bg-surface-low/50">
              <THead className="bg-surface-low">
                <TR>
                  <TH>Title</TH>
                  <TH>Source</TH>
                  <TH>Status</TH>
                  <TH>Date</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row, i) =>
                  row.kind === "personal" ? (
                    <MotionTR key={`u-${row.doc.id}`} index={i}>
                      <TD className="text-sm font-medium">{row.doc.title}</TD>
                      <TD className="text-sm">
                        <span className="rounded-[var(--radius-chip)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--accent-strong)]">
                          Personal
                        </span>
                      </TD>
                      <TD className="text-sm text-muted">—</TD>
                      <TD className="tabular text-sm text-muted">
                        {formatDate(row.doc.created_at)}
                      </TD>
                      <TD className="text-right">
                        <UserDocumentRowActions
                          doc={row.doc}
                          downloadUrl={row.signedUrl}
                        />
                      </TD>
                    </MotionTR>
                  ) : (
                    <MotionTR key={`o-${row.doc.id}`} index={i}>
                      <TD className="text-sm font-medium">{row.doc.name}</TD>
                      <TD className="text-sm">
                        <span className="rounded-[var(--radius-chip)] bg-container px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                          Org-assigned
                        </span>
                      </TD>
                      <TD className="text-sm">
                        <span
                          className={
                            row.doc.status === "pending"
                              ? "font-medium text-[var(--accent-strong)]"
                              : "text-muted"
                          }
                        >
                          {statusLabel(row.doc.status)}
                        </span>
                      </TD>
                      <TD className="tabular text-sm text-muted">
                        {formatDate(row.doc.created_at)}
                      </TD>
                      <TD className="text-right">
                        <OrgAssignedDocumentRowActions
                          doc={row.doc}
                          signedUrl={row.signedUrl}
                        />
                      </TD>
                    </MotionTR>
                  ),
                )}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {uploadOpen ? (
        <UploadUserDocumentModal onClose={() => setUploadOpen(false)} />
      ) : null}
    </>
  );
}
