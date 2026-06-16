"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import type { UserDocPreviewKind } from "@/lib/user-documents/preview";

function DocxPreview({ url, title }: { url: string; title: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch failed");
        const buffer = await res.arrayBuffer();
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (!cancelled) setHtml(result.value);
      } catch (err) {
        console.error("[user-documents] docx preview failed:", err);
        if (!cancelled) setFailed(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted">
          Couldn&apos;t preview this document. Download to open it locally.
        </p>
        <a href={url} download={title} className={buttonStyles("secondary", "sm")}>
          Download
        </a>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <svg
          className="h-8 w-8 animate-spin text-[var(--accent)]"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  return (
    <article
      className="max-w-3xl p-6 text-sm leading-relaxed text-ink sm:mx-auto sm:p-10 [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:my-3 [&_ol]:list-decimal [&_p]:my-2 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--line)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--line)] [&_th]:bg-surface [&_th]:p-2 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

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
      <div className="relative min-h-0 flex-1 overflow-auto bg-surface-low">
        {previewKind === "pdf" ? (
          <iframe
            src={url}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : previewKind === "docx" ? (
          <DocxPreview url={url} title={downloadName} />
        ) : (
          <div className="flex h-full min-h-[50vh] items-center justify-center overflow-auto p-4 sm:p-8">
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
