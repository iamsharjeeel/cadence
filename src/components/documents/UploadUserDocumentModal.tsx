"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import {
  uploadPersonalUserDocument,
  type ActionResult,
} from "@/app/app/documents/user-doc-actions";
import { USER_DOC_ALLOWED_EXT } from "@/lib/user-documents/constants";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Upload
    </Button>
  );
}

export function UploadUserDocumentModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [state, action] = useFormState(uploadPersonalUserDocument, null);
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

  const accept = USER_DOC_ALLOWED_EXT.join(",");

  return (
    <MotionModal open onClose={onClose} panelClassName="max-h-[90vh] max-w-lg overflow-y-auto">
      <h2 className="font-display text-lg font-semibold tracking-tightest">
        Upload document
      </h2>
      <p className="mt-1 text-sm text-muted">
        PDF, Office docs, images, or TXT — max 10MB. Saved to your personal
        library.
      </p>

      <form
        action={action}
        encType="multipart/form-data"
        className="mt-5 flex flex-col gap-4"
      >
        <Input
          label="Title (optional)"
          name="title"
          placeholder="Uses file name if empty"
        />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">File</span>
          <input
            type="file"
            name="file"
            accept={accept}
            required
            className="text-sm"
          />
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
