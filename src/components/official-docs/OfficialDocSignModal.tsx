"use client";

import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { OfficialDocument } from "@/types/db";
import {
  acknowledgeOfficialDocument,
  getOfficialDocumentUrl,
  signOfficialDocument,
} from "@/app/app/official-documents/actions";

export function OfficialDocSignModal({
  document,
  onClose,
}: {
  document: OfficialDocument;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    getOfficialDocumentUrl(document.id).then((r) => {
      if (r.ok && r.url) setUrl(r.url);
      else toast(r.message ?? "Couldn't load document.", "error");
    });
  }, [document.id, toast]);

  async function submit() {
    setBusy(true);
    if (document.signing_type === "acknowledgement") {
      if (!ack) {
        toast("Please confirm you have read the document.", "error");
        setBusy(false);
        return;
      }
      const r = await acknowledgeOfficialDocument(document.id);
      toast(r.message, r.ok ? "success" : "error");
      if (r.ok) onClose();
    } else {
      const pad = sigRef.current;
      if (!pad || pad.isEmpty()) {
        toast("Please draw your signature.", "error");
        setBusy(false);
        return;
      }
      const r = await signOfficialDocument(document.id, pad.toDataURL("image/png"));
      toast(r.message, r.ok ? "success" : "error");
      if (r.ok) onClose();
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{document.name}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        {document.file_type === "pdf" && url ? (
          <iframe
            src={url}
            title={document.name}
            className="h-full w-full rounded-[var(--radius)] border"
          />
        ) : url ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-muted">
              Download and review this document, then acknowledge below.
            </p>
            <a href={url} target="_blank" rel="noreferrer">
              <Button variant="secondary">Download to review</Button>
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted">Loading document…</p>
        )}
      </div>
      <div className="border-t px-6 py-4">
        {document.signing_type === "acknowledgement" ? (
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            I have read and understood this document.
          </label>
        ) : (
          <div className="mb-4 rounded-[var(--radius)] border bg-surface p-2">
            <p className="mb-2 text-xs text-muted">Draw your signature</p>
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                className: "h-32 w-full rounded-[var(--radius)] bg-white",
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => sigRef.current?.clear()}
            >
              Clear
            </Button>
          </div>
        )}
        <Button onClick={submit} disabled={busy}>
          {document.signing_type === "e_signature"
            ? "Sign document"
            : "Acknowledge"}
        </Button>
      </div>
    </div>
  );
}
