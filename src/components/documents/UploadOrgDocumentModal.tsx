"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import {
  uploadOrgLibraryDocument,
  type ActionResult,
} from "@/app/app/org-documents/actions";
import { ORG_DOC_ALLOWED_EXT, ORG_DOC_CATEGORIES } from "@/lib/org-documents/constants";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Upload to library
    </Button>
  );
}

export function UploadOrgDocumentModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [state, action] = useFormState(uploadOrgLibraryDocument, null);
  const lastState = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastState.current) {
      lastState.current = state;
      toast(state.message, state.ok ? "success" : "error");
      if (state.ok) {
        router.refresh();
        onClose();
      }
    }
  }, [state, toast, router, onClose]);

  const accept = ORG_DOC_ALLOWED_EXT.join(",");

  return (
    <MotionModal open onClose={onClose} panelClassName="max-h-[90vh] max-w-lg overflow-y-auto">
      <h2 className="font-display text-lg font-semibold tracking-tightest">
        Upload to organization library
      </h2>
      <p className="mt-1 text-sm text-muted">
        Master documents live in your org library. Assign copies to members when
        you&apos;re ready — they must acknowledge receipt.
      </p>

      <form
        action={action}
        encType="multipart/form-data"
        className="mt-5 flex flex-col gap-4"
      >
        <Input label="Document name" name="name" required placeholder="e.g. Remote work policy" />

        <Select
          label="Category"
          name="category"
          required
          className="h-10 text-sm"
          options={[
            { label: "— Select category —", value: "" },
            ...ORG_DOC_CATEGORIES.map((c) => ({
              label: c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
              value: c,
            })),
          ]}
        />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">File (PDF or DOCX, max 20MB)</span>
          <input type="file" name="file" accept={accept} required className="text-sm" />
        </label>

        <div className="flex gap-3">
          <SubmitBtn />
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </MotionModal>
  );
}
