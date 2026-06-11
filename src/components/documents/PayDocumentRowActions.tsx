"use client";

import { useRouter } from "next/navigation";

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
    { label: "View", href: url, target: "_blank" },
    { label: "Download", href: url, download: filename },
    { label: "Re-send", onClick: resend },
    ...(isManager
      ? DOCUMENT_STATUSES.filter((s) => s !== currentStatus).map((status) => ({
          label: `Mark ${status.replace(/_/g, " ")}`,
          onClick: () => setStatus(status),
        }))
      : []),
  ];

  return <RowActionsMenu actions={actions} />;
}
