"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";

import { useToast } from "@/components/ui/Toast";
import { cn, titleCase } from "@/lib/utils";
import {
  switchWorkspace,
  createOrganizationAction,
  acceptInvite,
  type ActionResult,
} from "@/app/app/workspace/actions";
import { useWorkspaceSwitch } from "@/components/app/WorkspaceSwitchContext";

export type SwitcherMembership = {
  orgId: string;
  name: string;
  role: string;
};

export type SwitcherInvite = {
  id: string;
  orgName: string;
  role: string;
};

function workspaceInitial(name: string, fallback = "W") {
  const first = name.trim().charAt(0);
  return (first || fallback).toUpperCase();
}

function InitialBadge({
  name,
  personal = false,
  subtle = false,
}: {
  name: string;
  personal?: boolean;
  subtle?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-none border text-[11px] font-semibold leading-none",
        personal
          ? "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "border-[var(--line)] bg-surface-low text-ink",
        subtle && "opacity-80",
      )}
      aria-hidden
    >
      {workspaceInitial(name, personal ? "P" : "W")}
    </span>
  );
}

function CreateOrgSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-[var(--radius-input)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create & switch"}
    </button>
  );
}

export function WorkspaceSwitcher({
  activeOrgId,
  isSuperadmin,
  canCreateOrg,
  memberships,
  pendingInvites,
  currentLabel,
  currentSublabel,
  currentLogoName,
  currentLogoUrl,
  onNavigate,
}: {
  activeOrgId: string | null;
  isSuperadmin: boolean;
  canCreateOrg: boolean;
  memberships: SwitcherMembership[];
  pendingInvites: SwitcherInvite[];
  currentLabel: string;
  currentSublabel: string;
  currentLogoName: string;
  currentLogoUrl: string | null;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { beginSwitch, endSwitch } = useWorkspaceSwitch();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const [createState, createAction] = useFormState<ActionResult | null, FormData>(
    createOrganizationAction,
    null,
  );
  const lastCreateResult = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!createState || createState === lastCreateResult.current) return;
    lastCreateResult.current = createState;
    toast(createState.message, createState.ok ? "success" : "error");
    if (createState.ok) {
      setOpen(false);
      setCreating(false);
      onNavigate?.();
      beginSwitch("Setting up workspace…");
      router.refresh();
      router.push("/app/dashboard");
    }
  }, [createState, toast, router, onNavigate, beginSwitch]);

  function choose(orgId: string | null) {
    if (orgId === activeOrgId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    onNavigate?.();
    beginSwitch();
    startTransition(async () => {
      const result = await switchWorkspace(orgId);
      if (!result.ok) {
        endSwitch();
        toast(result.message, "error");
        return;
      }
      router.refresh();
      router.push("/app/dashboard");
    });
  }

  function accept(inviteId: string) {
    setOpen(false);
    onNavigate?.();
    beginSwitch("Joining workspace…");
    startTransition(async () => {
      const result = await acceptInvite(inviteId);
      if (!result.ok) {
        endSwitch();
        toast(result.message, "error");
        return;
      }
      router.refresh();
      router.push("/app/dashboard");
    });
  }

  const rowBase =
    "group flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent-soft)]/40 disabled:cursor-not-allowed disabled:opacity-60";
  const currentIsPersonal = activeOrgId === null;
  const hasCurrentLogo = Boolean(currentLogoUrl);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        className="flex w-full items-center gap-2.5 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface-low px-2.5 py-2.5 text-left transition-colors hover:border-[var(--accent)]/40 disabled:opacity-60"
      >
        <InitialBadge
          name={currentLogoName}
          personal={currentIsPersonal}
          subtle={!currentIsPersonal && hasCurrentLogo}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">
            {currentLabel}
          </p>
          <p className="truncate text-[11px] text-muted">{currentSublabel}</p>
        </div>
        {pendingInvites.length > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold text-white">
            {pendingInvites.length}
          </span>
        ) : null}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="shrink-0 text-muted"
        >
          <path
            d="M8 9l4 4 4-4M8 15l4-4 4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface p-1.5 shadow-float">
          {pendingInvites.length > 0 ? (
            <>
              <p className="px-2.5 pb-1 pt-1 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Invitations
              </p>
              <div className="overflow-hidden rounded-[var(--radius-input)] border border-[var(--line)]">
                {pendingInvites.map((inv, index) => (
                  <div
                    key={inv.id}
                    className={cn(
                      "flex items-center gap-2.5 bg-surface px-2.5 py-2",
                      index > 0 && "border-t border-[var(--line)]",
                    )}
                  >
                    <InitialBadge name={inv.orgName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {inv.orgName}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        Invited as {titleCase(inv.role)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => accept(inv.id)}
                      disabled={pending}
                      className="rounded-[var(--radius-input)] bg-[var(--accent)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:opacity-60"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
              <div className="my-1.5 border-t border-[var(--line)]" />
            </>
          ) : null}
          <p className="px-2.5 pb-1 pt-1 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Switch workspace
          </p>
          <div className="overflow-hidden rounded-[var(--radius-input)] border border-[var(--line)]">
            <button
              type="button"
              className={cn(rowBase, currentIsPersonal && "bg-[var(--accent-soft)]/30")}
              onClick={() => choose(null)}
              disabled={pending}
            >
              <InitialBadge name="Personal" personal />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  Personal
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {isSuperadmin ? "Platform oversight" : "Your personal workspace"}
                </span>
              </span>
              {currentIsPersonal ? <ActiveDot /> : null}
            </button>

            {memberships.map((m) => (
              <button
                key={m.orgId}
                type="button"
                className={cn(
                  rowBase,
                  "border-t border-[var(--line)]",
                  activeOrgId === m.orgId && "bg-[var(--accent-soft)]/30",
                )}
                onClick={() => choose(m.orgId)}
                disabled={pending}
              >
                <InitialBadge name={m.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {m.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {titleCase(m.role)}
                  </span>
                </span>
                {activeOrgId === m.orgId ? <ActiveDot /> : null}
              </button>
            ))}
          </div>

          {!isSuperadmin && canCreateOrg ? (
            <>
              <div className="my-1.5 border-t border-[var(--line)]" />
              {creating ? (
                <form
                  action={createAction}
                  onSubmit={() => beginSwitch("Creating organization…")}
                  className="flex flex-col gap-2 p-2"
                >
                  <input
                    name="name"
                    autoFocus
                    required
                    maxLength={80}
                    placeholder="Organization name"
                    className="w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex gap-2">
                    <CreateOrgSubmitButton />
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="rounded-[var(--radius-input)] border border-[var(--line)] px-3 py-2 text-sm text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className={cn(rowBase, "rounded-[var(--radius-input)]")}
                  onClick={() => setCreating(true)}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-none border border-dashed border-[var(--line)] text-muted">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="text-[13px] font-semibold text-ink">
                    Create organization
                  </span>
                </button>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActiveDot() {
  return (
    <span
      aria-label="current"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--accent)]/35 bg-[var(--accent-soft)]"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
    </span>
  );
}
