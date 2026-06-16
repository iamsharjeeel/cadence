"use client";

import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import type { UserDocPreviewKind } from "@/lib/user-documents/preview";
import { useEffect } from "react";

export function UserDocumentViewer({
  title,
  url,
  previewKind,
  downloadName,
  onClose,
}: {
  title: string;
  url: string;
  previewKind: UserDocPreviewKind;
  downloadName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[var(--surface)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-6">
        <h2 className="min-w-0 truncate font-display text-base font-semibold tracking-tight text-ink sm:text-lg">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={url}
            download={downloadName}
            className={buttonStyles("secondary", "sm")}
          >
            Download
          </a>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-surface-low">
        {previewKind === "pdf" ? (
          <iframe
            src={url}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center overflow-auto p-4 sm:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={title}
              className="max-h-full max-w-full object-contain shadow-card"
            />
          </div>
        )}
      </div>
    </div>
  );
}
