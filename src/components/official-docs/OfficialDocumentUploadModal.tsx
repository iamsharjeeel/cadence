"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { uploadOfficialDocument } from "@/app/app/official-documents/actions";
import type { ActionResult } from "@/app/app/official-documents/actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Uploading…" : "Upload"}
    </Button>
  );
}

export function OfficialDocumentUploadModal({
  employees,
  orgOptions,
  selectedOrgId,
  onClose,
}: {
  employees: { id: string; name: string }[];
  orgOptions?: { id: string; name: string }[];
  selectedOrgId?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [state, action] = useFormState(uploadOfficialDocument, null);
  const lastState = useRef<ActionResult | null>(null);
  const [orgId, setOrgId] = useState(selectedOrgId ?? orgOptions?.[0]?.id ?? "");

  useEffect(() => {
    if (state && state !== lastState.current) {
      lastState.current = state;
      toast(state.message, state.ok ? "success" : "error");
      if (state.ok) {
        router.refresh();
        onClose();
      }
    }
  }, [state, toast, router, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius)] border bg-surface p-6 shadow-card"
        role="dialog"
        aria-modal
        aria-labelledby="upload-official-doc-title"
      >
        <h2
          id="upload-official-doc-title"
          className="text-lg font-semibold tracking-tightest"
        >
          Upload document
        </h2>
        <p className="mt-1 text-sm text-muted">
          PDF or DOCX, max 20MB. Assigned employees see it in Documents and
          onboarding.
        </p>

        <form
          action={action}
          encType="multipart/form-data"
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          {orgOptions && orgOptions.length > 0 && (
            <div className="sm:col-span-2">
              <Select
                label="Organization"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="h-10 text-sm"
                options={orgOptions.map((o) => ({
                  label: o.name,
                  value: o.id,
                }))}
              />
              <input type="hidden" name="org_id" value={orgId} />
            </div>
          )}

          <Input label="Document name" name="name" required className="sm:col-span-2" />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Category</span>
            <select
              name="category"
              className="h-10 rounded-[var(--radius)] border bg-surface px-3"
            >
              <option value="contract">Contract</option>
              <option value="offer_letter">Offer letter</option>
              <option value="policy">Policy</option>
              <option value="nda">NDA</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Signing type</span>
            <select
              name="signing_type"
              className="h-10 rounded-[var(--radius)] border bg-surface px-3"
            >
              <option value="e_signature">E-signature</option>
              <option value="acknowledgement">Acknowledgement</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Assign to employee</span>
            <select
              name="employee_id"
              className="h-10 rounded-[var(--radius)] border bg-surface px-3"
            >
              <option value="">— Select employee —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="assign_all"
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Assign to all employees in organization
          </label>

          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">File (PDF or DOCX, max 20MB)</span>
            <input
              type="file"
              name="file"
              accept=".pdf,.docx"
              required
              className="text-sm"
            />
          </label>

          <div className="flex gap-3 sm:col-span-2">
            <SubmitBtn />
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
