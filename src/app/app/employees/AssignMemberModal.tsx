"use client";

import { useState, useTransition } from "react";

import { MotionModal } from "@/components/motion/MotionModal";
import { Button } from "@/components/ui/Button";
import { fieldBase } from "@/components/ui/Input";
import { cn, roleLabel } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { assignMemberToOrg } from "./assign-actions";
import type { UserRole } from "@/types/db";

type OrgOption = { id: string; name: string };

export function AssignMemberModal({
  memberId,
  memberName,
  memberEmail,
  orgs,
}: {
  memberId: string;
  memberName: string;
  memberEmail: string;
  orgs: OrgOption[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [role, setRole] = useState<UserRole>("employee");
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    if (!orgId) {
      toast("Select an organization.", "error");
      return;
    }
    startTransition(async () => {
      const result = await assignMemberToOrg(memberId, orgId, role);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Assign to org
      </Button>

      <MotionModal
        open={open}
        onClose={() => !pending && setOpen(false)}
        panelClassName="max-w-md"
      >
        <h2 className="font-display text-lg font-semibold text-ink">
          Assign to organization
        </h2>
        <p className="mt-2 text-sm text-muted">
          Add{" "}
          <span className="font-medium text-ink">
            {memberName || memberEmail}
          </span>{" "}
          to an organization. Role and rate can be set after assignment.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink" htmlFor={`org-${memberId}`}>
              Organization
            </label>
            <select
              id={`org-${memberId}`}
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              disabled={pending || orgs.length === 0}
              className={cn(fieldBase, "h-9 text-sm")}
            >
              {orgs.length === 0 ? (
                <option value="">No organizations</option>
              ) : (
                orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink" htmlFor={`role-${memberId}`}>
              Role
            </label>
            <select
              id={`role-${memberId}`}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={pending}
              className={cn(fieldBase, "h-9 text-sm")}
            >
              <option value="employee">{roleLabel("employee")}</option>
              <option value="admin">{roleLabel("admin")}</option>
              <option value="owner">{roleLabel("owner")}</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={pending}
            disabled={!orgId}
            onClick={handleAssign}
          >
            Assign
          </Button>
        </div>
      </MotionModal>
    </>
  );
}
