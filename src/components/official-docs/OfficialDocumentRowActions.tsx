"use client";

import { useState, useEffect } from "react";

import { DocumentViewModal } from "@/components/documents/DocumentViewModal";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import type { OfficialDocument } from "@/types/db";
import { OfficialDocSignModal } from "@/components/official-docs/OfficialDocSignModal";
import { getOfficialDocumentUrl } from "@/app/app/official-documents/actions";

export function OfficialDocumentRowActions({
  document,
  url,
  isManager,
}: {
  document: OfficialDocument;
  url?: string;
  isManager: boolean;
}) {
  const [signOpen, setSignOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(url ?? null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    if (!viewOpen) return;
    if (url) {
      setViewUrl(url);
      setViewLoading(false);
      return;
    }
    setViewLoading(true);
    getOfficialDocumentUrl(document.id).then((result) => {
      setViewUrl(result.ok ? result.url ?? null : null);
      setViewLoading(false);
    });
  }, [viewOpen, url, document.id]);

  const actions = [
    {
      label: "View",
      onClick: () => setViewOpen(true),
    },
    url || viewUrl
      ? {
          label: "Download",
          href: url ?? viewUrl ?? undefined,
          download: document.name,
        }
      : null,
    !isManager && document.status === "pending"
      ? {
          label:
            document.signing_type === "e_signature" ? "Sign" : "Acknowledge",
          onClick: () => setSignOpen(true),
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    href?: string;
    target?: string;
    download?: string;
    onClick?: () => void;
  }[];

  return (
    <>
      <RowActionsMenu actions={actions} />
      {viewOpen && (
        <DocumentViewModal
          title={document.name}
          url={viewUrl}
          loading={viewLoading}
          onClose={() => {
            setViewOpen(false);
            setViewUrl(url ?? null);
          }}
        />
      )}
      {signOpen && (
        <OfficialDocSignModal
          document={document}
          onClose={() => setSignOpen(false)}
        />
      )}
    </>
  );
}
