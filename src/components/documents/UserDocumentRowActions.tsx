"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { UserDocument } from "@/types/db";
import { deleteUserDocument } from "@/app/app/documents/user-doc-actions";

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
  const canDelete = doc.source === "personal";

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

  const actions = [
    ...(downloadUrl
      ? [
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
  return <RowActionsMenu actions={actions} />;
}
