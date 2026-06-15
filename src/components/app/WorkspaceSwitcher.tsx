"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { OrgLogo } from "@/components/brand/OrgLogo";
import { titleCase } from "@/lib/utils";
import {
  switchWorkspace,
  createOrganizationAction,
} from "@/app/app/workspace/actions";

export type SwitcherMembership = {
  orgId: string;
  name: string;
  role: string;
};

export function WorkspaceSwitcher({
  activeOrgId,
  isSuperadmin,
  memberships,
  currentLabel,
  currentSublabel,
  currentLogoName,
  currentLogoUrl,
  onNavigate,
}: {
  activeOrgId: string | null;
  isSuperadmin: boolean;
  memberships: SwitcherMembership[];
  currentLabel: string;
  currentSublabel: string;
  currentLogoName: string;
  currentLogoUrl: string | null;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

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

  function choose(orgId: string | null) {
    if (orgId === activeOrgId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    onNavigate?.();
    startTransition(() => {
      void switchWorkspace(orgId);
    });
  }

  const rowBase =
    "flex w-full items-center gap-3 rounded-[var(--radius-input)] px-3 py-2 text-left transition-colors hover:bg-[var(--accent-soft)]/50";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface-low p-3 text-left transition-colors hover:border-[var(--accent)]/40 disabled:opacity-60"
      >
        <OrgLogo name={currentLogoName} logoUrl={currentLogoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {currentLabel}
          </p>
          <p className="truncate text-xs text-muted">{currentSublabel}</p>
        </div>
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
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface p-2 shadow-float">
          <p className="px-3 pb-1 pt-1 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Switch workspace
          </p>

          <button
            type="button"
            className={rowBase}
            onClick={() => choose(null)}
          >
            <OrgLogo name="Personal" logoUrl={null} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                Personal
              </span>
              <span className="block truncate text-xs text-muted">
                {isSuperadmin ? "Platform admin" : "Your personal workspace"}
              </span>
            </span>
            {activeOrgId === null ? <ActiveDot /> : null}
          </button>

          {memberships.map((m) => (
            <button
              key={m.orgId}
              type="button"
              className={rowBase}
              onClick={() => choose(m.orgId)}
            >
              <OrgLogo name={m.name} logoUrl={null} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {m.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {titleCase(m.role)}
                </span>
              </span>
              {activeOrgId === m.orgId ? <ActiveDot /> : null}
            </button>
          ))}

          {!isSuperadmin ? (
            <>
              <div className="my-1 border-t border-[var(--line)]" />
              {creating ? (
                <form
                  action={createOrganizationAction}
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
                    <button
                      type="submit"
                      className="flex-1 rounded-[var(--radius-input)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-strong)]"
                    >
                      Create &amp; switch
                    </button>
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
                  className={rowBase}
                  onClick={() => setCreating(true)}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[var(--line)] text-muted">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-ink">
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
      className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
    />
  );
}
