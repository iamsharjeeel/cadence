"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import type { OfficialDocument } from "@/types/db";
import { OfficialDocSignModal } from "./OfficialDocSignModal";

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
  const [signDoc, setSignDoc] = useState<OfficialDocument | null>(null);

  return (
    <div>
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
          {documents.map((d) => {
            const url = downloadUrls.get(d.id);
            return (
              <TR key={d.id}>
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
                  <div className="flex justify-end gap-2">
                    {url && (
                      <>
                        <a href={url} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </a>
                        <a href={url} download>
                          <Button variant="ghost" size="sm">
                            Download
                          </Button>
                        </a>
                      </>
                    )}
                    {!isManager && d.status === "pending" && (
                      <Button size="sm" onClick={() => setSignDoc(d)}>
                        {d.signing_type === "e_signature" ? "Sign" : "Acknowledge"}
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      {signDoc && (
        <OfficialDocSignModal document={signDoc} onClose={() => setSignDoc(null)} />
      )}
    </div>
  );
}
