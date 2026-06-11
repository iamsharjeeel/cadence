"use client";

import { useState } from "react";

import { DocumentViewModal } from "@/components/documents/DocumentViewModal";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { useToast } from "@/components/ui/Toast";
import {
  DOCUMENT_STATUSES,
  type DocumentStatus,
} from "@/lib/documents/types";
import {
  resendDocumentEmail,
  updateDocumentStatus,
} from "@/app/app/documents/actions";
import { useRouter } from "next/navigation";

export function PayDocumentRowActions({
  id,
  url,
  filename,
  currentStatus,
  isManager,
}: {
  id: string;
  url: string;
  filename: string;
  currentStatus: DocumentStatus;
  isManager: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [viewOpen, setViewOpen] = useState(false);

  async function setStatus(status: DocumentStatus) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    const result = await updateDocumentStatus(null, fd);
    toast(result.message, result.ok ? "success" : "error");
    if (result.ok) router.refresh();
  }

  async function resend() {
    const fd = new FormData();
    fd.set("id", id);
    const result = await resendDocumentEmail(null, fd);
    toast(result.message, result.ok ? "success" : "error");
  }

  const actions = [
    {
      label: "View",
      onClick: () => setViewOpen(true),
    },
    { label: "Download", href: url, download: filename },
    { label: "Re-send", onClick: resend },
    ...(isManager
      ? DOCUMENT_STATUSES.filter((s) => s !== currentStatus).map((status) => ({
          label: `Mark ${status.replace(/_/g, " ")}`,
          onClick: () => setStatus(status),
        }))
      : []),
  ];

  return (
    <>
      <RowActionsMenu actions={actions} />
      {viewOpen && (
        <DocumentViewModal
          title={filename}
          url={url}
          loading={false}
          onClose={() => setViewOpen(false)}
        />
      )}
    </>
  );
}
