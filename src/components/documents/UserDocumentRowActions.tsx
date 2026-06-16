"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { useToast } from "@/components/ui/Toast";
import type { UserDocument } from "@/types/db";
import { deleteUserDocument } from "@/app/app/documents/user-doc-actions";
import {
  userDocPreviewKind,
  userDocPreviewable,
} from "@/lib/user-documents/preview";
import { UserDocumentViewer } from "./UserDocumentViewer";

export function UserDocumentRowActions({
  doc,
  downloadUrl,
}: {
  doc: UserDocument;
  downloadUrl?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const canDelete = doc.source === "personal";
  const previewKind = userDocPreviewKind(doc.mime_type, doc.file_name);
  const canPreview = Boolean(downloadUrl && previewKind);

  async function remove() {
    setBusy(true);
    try {
      const result = await deleteUserDocument(doc.id);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function view() {
    if (!downloadUrl) return;
    if (!userDocPreviewable(doc.mime_type, doc.file_name)) {
      toast(
        "Preview isn't available for this file type. Download to open it.",
        "error",
      );
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setViewerOpen(true);
  }

  const actions = [
    ...(downloadUrl
      ? [
          {
            label: canPreview ? "View" : "Open",
            onClick: view,
          },
          {
            label: "Download",
            href: downloadUrl,
            download: doc.file_name ?? doc.title,
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: busy ? "Deleting…" : "Delete",
            onClick: remove,
          },
        ]
      : []),
  ];

  if (!actions.length) return null;

  return (
    <>
      <RowActionsMenu actions={actions} />
      {viewerOpen && downloadUrl && previewKind ? (
        <UserDocumentViewer
          title={doc.title}
          url={downloadUrl}
          previewKind={previewKind}
          downloadName={doc.file_name ?? doc.title}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </>
  );
}
