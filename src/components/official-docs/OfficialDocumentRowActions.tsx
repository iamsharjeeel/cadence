"use client";

import { useState } from "react";

import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import type { OfficialDocument } from "@/types/db";
import { OfficialDocSignModal } from "@/components/official-docs/OfficialDocSignModal";

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

  const actions = [
    url
      ? { label: "View", href: url, target: "_blank" }
      : null,
    url ? { label: "Download", href: url, download: document.name } : null,
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
      {signOpen && (
        <OfficialDocSignModal
          document={document}
          onClose={() => setSignOpen(false)}
        />
      )}
    </>
  );
}
