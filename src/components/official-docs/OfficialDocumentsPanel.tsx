"use client";

import { useState } from "react";

import { MotionTR } from "@/components/motion/MotionTR";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import type { OfficialDocument } from "@/types/db";
import { OfficialDocumentRowActions } from "./OfficialDocumentRowActions";

function statusClass(status: string) {
  if (status === "signed" || status === "acknowledged") {
    return "text-[var(--accent-strong)]";
  }
  if (status === "rejected") return "text-[var(--danger)]";
  return "text-muted";
}

export function OfficialDocumentsPanel({
  documents,
  isManager,
  downloadUrls,
}: {
  documents: (OfficialDocument & { employee_name?: string })[];
  isManager: boolean;
  downloadUrls: Map<string, string>;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          {isManager && <TH>Employee</TH>}
          <TH>Category</TH>
          <TH>Signing</TH>
          <TH>Status</TH>
          <TH>Uploaded</TH>
          <TH className="text-right">Actions</TH>
        </TR>
      </THead>
      <TBody>
        {documents.map((d, i) => (
          <MotionTR key={d.id} index={i}>
            <TD className="text-sm font-medium">{d.name}</TD>
            {isManager && (
              <TD className="text-sm">{d.employee_name ?? "—"}</TD>
            )}
            <TD className="text-sm capitalize text-muted">
              {d.category.replace(/_/g, " ")}
            </TD>
            <TD className="text-sm text-muted">
              {d.signing_type === "e_signature" ? "E-signature" : "Acknowledge"}
            </TD>
            <TD className={`text-sm capitalize ${statusClass(d.status)}`}>
              {d.status}
            </TD>
            <TD className="tnum text-sm text-muted">
              {formatDate(d.created_at)}
            </TD>
            <TD>
              <OfficialDocumentRowActions
                document={d}
                url={downloadUrls.get(d.id)}
                isManager={isManager}
              />
            </TD>
          </MotionTR>
        ))}
      </TBody>
    </Table>
  );
}
