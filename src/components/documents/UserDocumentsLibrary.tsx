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
import type { UserDocument } from "@/types/db";
import { UploadUserDocumentModal } from "./UploadUserDocumentModal";
import { AssignUserDocumentModal } from "./AssignUserDocumentModal";
import { UserDocumentRowActions } from "./UserDocumentRowActions";

export function UserDocumentsLibrary({
  documents,
  downloadUrls,
  canUploadPersonal,
  canAssignToMember,
  members,
}: {
  documents: UserDocument[];
  downloadUrls: Record<string, string>;
  canUploadPersonal: boolean;
  canAssignToMember: boolean;
  members: { id: string; name: string }[];
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

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
          <div className="flex flex-wrap gap-2">
            {canUploadPersonal ? (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                Upload document
              </Button>
            ) : null}
            {canAssignToMember ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAssignOpen(true)}
                disabled={members.length === 0}
              >
                Assign to member
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
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
                  <TH>File</TH>
                  <TH>Source</TH>
                  <TH>Uploaded</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {documents.map((doc, i) => (
                  <MotionTR key={doc.id} index={i}>
                    <TD className="text-sm font-medium">{doc.title}</TD>
                    <TD className="max-w-[12rem] truncate text-sm text-muted">
                      {doc.file_name ?? "—"}
                    </TD>
                    <TD className="text-sm">
                      {doc.source === "org_assigned" ? (
                        <span className="rounded-[var(--radius-chip)] bg-container px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                          Org-assigned
                        </span>
                      ) : (
                        <span className="rounded-[var(--radius-chip)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--accent-strong)]">
                          Personal
                        </span>
                      )}
                    </TD>
                    <TD className="tabular text-sm text-muted">
                      {formatDate(doc.created_at)}
                    </TD>
                    <TD className="text-right">
                      <UserDocumentRowActions
                        doc={doc}
                        downloadUrl={downloadUrls[doc.id]}
                      />
                    </TD>
                  </MotionTR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {uploadOpen ? (
        <UploadUserDocumentModal onClose={() => setUploadOpen(false)} />
      ) : null}
      {assignOpen ? (
        <AssignUserDocumentModal
          members={members}
          onClose={() => setAssignOpen(false)}
        />
      ) : null}
    </>
  );
}
