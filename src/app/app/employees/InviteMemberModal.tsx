"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import { inviteMember, type InviteRoleOption } from "./invite-actions";

const ROLE_OPTIONS: { value: InviteRoleOption; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Manager" },
  { value: "employee", label: "Employee" },
];

export function InviteMemberModal({
  actorRole,
  orgName,
}: {
  actorRole: "admin" | "owner" | "superadmin";
  orgName: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRoleOption>("employee");
  const [pending, setPending] = useState(false);

  const isManagerOnly = actorRole === "admin";
  const options = isManagerOnly
    ? ROLE_OPTIONS.filter((o) => o.value === "employee")
    : ROLE_OPTIONS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await inviteMember({ email, role });
    setPending(false);
    toast(result.message, result.ok ? "success" : "error");
    if (result.ok) {
      setEmail("");
      setRole("employee");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden />
        Invite member
      </Button>

      <MotionModal
        open={open}
        onClose={() => !pending && setOpen(false)}
        panelClassName="max-w-md"
      >
        <h2 className="font-display text-lg font-semibold tracking-tightest">
          Invite to {orgName}
        </h2>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll email them a link to sign in with Google and join your team.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            autoFocus
          />

          <Select
            label="Role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRoleOption)}
            options={options.map((o) => ({ value: o.value, label: o.label }))}
          />

          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Send invite
            </Button>
          </div>
        </form>
      </MotionModal>
    </>
  );
}
