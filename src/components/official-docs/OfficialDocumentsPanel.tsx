"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { OfficialDocument } from "@/types/db";
import { uploadOfficialDocument } from "@/app/app/official-documents/actions";
import { OfficialDocSignModal } from "./OfficialDocSignModal";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Uploading…" : "Upload"}
    </Button>
  );
}

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
  employees,
  downloadUrls,
}: {
  documents: (OfficialDocument & { employee_name?: string })[];
  isManager: boolean;
  employees: { id: string; name: string }[];
  downloadUrls: Map<string, string>;
}) {
  const { toast } = useToast();
  const [state, action] = useFormState(uploadOfficialDocument, null);
  const [signDoc, setSignDoc] = useState<OfficialDocument | null>(null);
  const lastState = useRef<typeof state>(null);

  useEffect(() => {
    if (state && state !== lastState.current) {
      lastState.current = state;
      toast(state.message, state.ok ? "success" : "error");
    }
  }, [state, toast]);

  return (
    <div>
      {isManager && (
        <form
          action={action}
          encType="multipart/form-data"
          className="mb-6 grid gap-4 rounded-[var(--radius)] border p-5 sm:grid-cols-2"
        >
          <h3 className="text-sm font-semibold sm:col-span-2">Upload document</h3>
          <Input label="Name" name="name" required />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Category</span>
            <select name="category" className="h-10 rounded-[var(--radius)] border px-3">
              <option value="contract">Contract</option>
              <option value="offer_letter">Offer letter</option>
              <option value="policy">Policy</option>
              <option value="nda">NDA</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Signing type</span>
            <select name="signing_type" className="h-10 rounded-[var(--radius)] border px-3">
              <option value="acknowledgement">Acknowledgement</option>
              <option value="e_signature">E-signature</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Assign to employee</span>
            <select name="employee_id" className="h-10 rounded-[var(--radius)] border px-3">
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="assign_all" className="h-4 w-4 accent-[var(--accent)]" />
            Assign to all employees
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">File (PDF or DOCX, max 20MB)</span>
            <input type="file" name="file" accept=".pdf,.docx" required className="text-sm" />
          </label>
          <div className="sm:col-span-2">
            <SubmitBtn />
          </div>
        </form>
      )}

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
          {documents.map((d) => (
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
                  {downloadUrls.get(d.id) && (
                    <a href={downloadUrls.get(d.id)} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="sm">
                        Download
                      </Button>
                    </a>
                  )}
                  {!isManager && d.status === "pending" && (
                    <Button size="sm" onClick={() => setSignDoc(d)}>
                      {d.signing_type === "e_signature" ? "Sign" : "Acknowledge"}
                    </Button>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {signDoc && (
        <OfficialDocSignModal document={signDoc} onClose={() => setSignDoc(null)} />
      )}
    </div>
  );
}
