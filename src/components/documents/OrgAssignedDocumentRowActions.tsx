"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  acknowledgeOrgOfficialDocument,
  getOrgOfficialDocumentUrl,
} from "@/app/app/org-documents/actions";
import {
  officialDocDownloadName,
  officialDocPreviewKind,
  officialDocPreviewable,
} from "@/lib/org-documents/preview";
import type { OfficialDocument } from "@/types/db";
import { UserDocumentViewer } from "./UserDocumentViewer";

export function OrgAssignedDocumentRowActions({
  doc,
  signedUrl,
}: {
  doc: OfficialDocument;
  signedUrl?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewUrl, setViewUrl] = useState(signedUrl ?? "");

  const pending = doc.status === "pending";
  const previewKind = officialDocPreviewKind(doc.file_type, doc.file_path);
  const canPreview = Boolean(viewUrl && previewKind);
  const downloadName = officialDocDownloadName(doc.name, doc.file_path, doc.file_type);

  async function ensureUrl(): Promise<string | null> {
    if (viewUrl) return viewUrl;
    const result = await getOrgOfficialDocumentUrl(doc.id);
    if (!result.ok || !result.url) {
      toast(result.message ?? "Couldn't open document.", "error");
      return null;
    }
    setViewUrl(result.url);
    return result.url;
  }

  async function view() {
    const url = await ensureUrl();
    if (!url) return;
    if (!officialDocPreviewable(doc.file_type, doc.file_path)) {
      toast("Preview isn't available for this file type. Download to open it.", "error");
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setViewerOpen(true);
  }

  async function acknowledge() {
    setBusy(true);
    try {
      const result = await acknowledgeOrgOfficialDocument(doc.id);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const actions = [
    ...(pending
      ? [
          {
            label: busy ? "Acknowledging…" : "Acknowledge",
            onClick: acknowledge,
          },
        ]
      : []),
    {
      label: canPreview ? "View" : "Open",
      onClick: view,
    },
    ...(viewUrl || signedUrl
      ? [
          {
            label: "Download",
            onClick: async () => {
              const url = await ensureUrl();
              if (url) window.open(url, "_blank", "noopener,noreferrer");
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {pending ? (
          <Button size="sm" variant="secondary" loading={busy} onClick={acknowledge}>
            I acknowledge
          </Button>
        ) : null}
        <RowActionsMenu actions={actions} />
      </div>
      {viewerOpen && viewUrl && previewKind ? (
        <UserDocumentViewer
          title={doc.name}
          url={viewUrl}
          previewKind={previewKind}
          downloadName={downloadName}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </>
  );
}
