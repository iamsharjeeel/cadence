"use client";

import { Button } from "@/components/ui/Button";

/** View opens PDF in a new tab; Download triggers a file save. */
export function DocumentActions({
  url,
  filename,
}: {
  url: string;
  filename: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <a href={url} target="_blank" rel="noreferrer">
        <Button variant="ghost" size="sm">
          View
        </Button>
      </a>
      <a href={url} download={filename}>
        <Button variant="ghost" size="sm">
          Download
        </Button>
      </a>
    </div>
  );
}
