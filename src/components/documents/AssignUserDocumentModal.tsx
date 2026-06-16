"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import {
  assignUserDocumentToMember,
  type ActionResult,
} from "@/app/app/documents/user-doc-actions";
import { USER_DOC_ALLOWED_EXT } from "@/lib/user-documents/constants";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Assign
    </Button>
  );
}

export function AssignUserDocumentModal({
  members,
  onClose,
}: {
  members: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [state, action] = useFormState(assignUserDocumentToMember, null);
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
        Assign document to member
      </h2>
      <p className="mt-1 text-sm text-muted">
        Upload a file to a team member&apos;s document library. They can view
        and download it but cannot delete it.
      </p>

      <form
        action={action}
        encType="multipart/form-data"
        className="mt-5 flex flex-col gap-4"
      >
        <Select
          label="Team member"
          name="owner_id"
          required
          className="h-10 text-sm"
          options={[
            { label: "— Select member —", value: "" },
            ...members.map((m) => ({ label: m.name, value: m.id })),
          ]}
        />

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
