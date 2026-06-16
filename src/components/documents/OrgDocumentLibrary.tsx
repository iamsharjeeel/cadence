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
import type { OrgLibraryDocument } from "@/lib/org-documents/queries";
import { UploadOrgDocumentModal } from "./UploadOrgDocumentModal";
import { AssignOrgDocumentModal } from "./AssignOrgDocumentModal";

function categoryLabel(category: string) {
  return category.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function OrgDocumentLibrary({
  documents,
  members,
}: {
  documents: OrgLibraryDocument[];
  members: { id: string; name: string }[];
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [assignDoc, setAssignDoc] = useState<OrgLibraryDocument | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Organization library</CardTitle>
            <CardDescription>
              Master documents for your organization. Assign copies to members —
              each must acknowledge receipt.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            Upload document
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No library documents yet"
                description="Upload policies, contracts, and other org documents here. Assign them to members when ready."
                action={
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    Upload document
                  </Button>
                }
              />
            </div>
          ) : (
            <Table className="[&_tbody_tr:nth-child(even)]:bg-surface-low/50">
              <THead className="bg-surface-low">
                <TR>
                  <TH>Name</TH>
                  <TH>Category</TH>
                  <TH>Uploaded</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {documents.map((doc, i) => (
                  <MotionTR key={doc.id} index={i}>
                    <TD className="text-sm font-medium">{doc.name}</TD>
                    <TD className="text-sm text-muted">{categoryLabel(doc.category)}</TD>
                    <TD className="tabular text-sm text-muted">
                      {formatDate(doc.created_at)}
                    </TD>
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={members.length === 0}
                        onClick={() => setAssignDoc(doc)}
                      >
                        Assign
                      </Button>
                    </TD>
                  </MotionTR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {uploadOpen ? (
        <UploadOrgDocumentModal onClose={() => setUploadOpen(false)} />
      ) : null}
      {assignDoc ? (
        <AssignOrgDocumentModal
          document={assignDoc}
          members={members}
          onClose={() => setAssignDoc(null)}
        />
      ) : null}
    </>
  );
}
