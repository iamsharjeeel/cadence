import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/db";

/**
 * Track C — workspace context.
 *
 * Source of truth for "which workspace is the caller acting in right now".
 * The active workspace is stored server-side in `active_workspace` (the same
 * row C2's auth_org() validates against memberships), so UI context and RLS
 * data scope ALWAYS agree.
 *
 * `effectiveProfile` re-points the legacy `profile.org_id` / `profile.role`
 * fields at the active workspace so existing role/org-scoped code keeps working:
 *   - superadmin  -> role 'superadmin', org_id null (platform oversight)
 *   - active org  -> role 'admin' (owner/admin) or 'employee', org_id = that org
 *   - personal    -> role 'employee', org_id null
 */

export type WorkspaceRole = "owner" | "admin" | "employee";

export type WorkspaceMembership = {
  orgId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: WorkspaceRole;
};

export type PendingInvite = {
  id: string;
  orgId: string;
  orgName: string;
  role: WorkspaceRole;
};

export type WorkspaceContext = {
  realProfile: Profile;
  /** profile with org_id + role re-pointed at the active workspace. */
  effectiveProfile: Profile;
  isSuperadmin: boolean;
  isPersonal: boolean;
  activeOrgId: string | null;
  activeOrg: WorkspaceMembership | null;
  workspaceRole: WorkspaceRole | null;
  memberships: WorkspaceMembership[];
  pendingInvites: PendingInvite[];
};

export type NavContext = "personal" | "employee" | "manager" | "superadmin";

export function navContextFor(ctx: WorkspaceContext): NavContext {
  if (ctx.isSuperadmin) return "superadmin";
  if (ctx.activeOrg) return ctx.workspaceRole === "employee" ? "employee" : "manager";
  return "personal";
}

/**
 * Resolves the caller's workspace context once per request (deduped via cache).
 */
export const getWorkspaceContext = cache(
  async (): Promise<WorkspaceContext | null> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: realProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (!realProfile) return null;

    const { data: memRows } = await supabase
      .from("memberships")
      .select("org_id, role, created_at")
      .order("created_at", { ascending: true });

    const orgIds = (memRows ?? []).map((m) => m.org_id);
    const orgById = new Map<
      string,
      { name: string; slug: string; logo_url: string | null }
    >();
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url")
        .in("id", orgIds);
      for (const o of orgs ?? []) {
        orgById.set(o.id, { name: o.name, slug: o.slug, logo_url: o.logo_url });
      }
    }

    const memberships: WorkspaceMembership[] = (memRows ?? []).map((m) => {
      const o = orgById.get(m.org_id);
      return {
        orgId: m.org_id,
        name: o?.name ?? "Organization",
        slug: o?.slug ?? "",
        logoUrl: o?.logo_url ?? null,
        role: (m.role ?? "employee") as WorkspaceRole,
      };
    });

    const { data: awRow } = await supabase
      .from("active_workspace")
      .select("org_id")
      .maybeSingle();

    // Invites addressed to this user's email (invite-only joining).
    const { data: inviteRows } = await supabase.rpc("pending_invites_for_me");
    const pendingInvites: PendingInvite[] = (inviteRows ?? []).map((r) => ({
      id: r.id,
      orgId: r.org_id,
      orgName: r.org_name,
      role: (r.role ?? "employee") as WorkspaceRole,
    }));

    const isSuperadmin = realProfile.role === "superadmin";

    const requestedOrgId: string | null = awRow?.org_id ?? null;
    // Validate the active workspace against real memberships (mirrors auth_org()).
    const activeMembership =
      requestedOrgId && !isSuperadmin
        ? memberships.find((m) => m.orgId === requestedOrgId) ?? null
        : null;

    const activeOrgId = activeMembership?.orgId ?? null;
    const workspaceRole = activeMembership?.role ?? null;
    const isPersonal = !isSuperadmin && !activeMembership;

    const effectiveRole: UserRole = isSuperadmin
      ? "superadmin"
      : workspaceRole === "owner" || workspaceRole === "admin"
        ? "admin"
        : "employee";

    const effectiveProfile: Profile = {
      ...realProfile,
      org_id: activeOrgId,
      role: effectiveRole,
    };

    return {
      realProfile,
      effectiveProfile,
      isSuperadmin,
      isPersonal,
      activeOrgId,
      activeOrg: activeMembership,
      workspaceRole,
      memberships,
      pendingInvites,
    };
  },
);
