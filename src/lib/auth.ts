import "server-only";

import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/workspace";
import type { Profile, UserRole } from "@/types/db";

/**
 * Server-side auth/session helpers.
 *
 * These are the single source of truth for "who is the caller and what may they
 * do". Server Actions MUST re-check the role here before any privileged write —
 * RLS is a backstop, not the only gate.
 */

/**
 * Returns the authenticated profile, or null if not signed in / no profile.
 *
 * Track C: `org_id` and `role` are re-pointed at the caller's ACTIVE workspace
 * (see `getWorkspaceContext`), so existing org/role-scoped code automatically
 * follows the workspace switcher and agrees with C2's RLS scope.
 */
export async function getProfile(): Promise<Profile | null> {
  const ctx = await getWorkspaceContext();
  return ctx?.effectiveProfile ?? null;
}

/**
 * Requires an authenticated, ACTIVE profile. Redirects otherwise. Use at the top
 * of `/app/**` Server Components and Actions.
 */
export async function requireActiveProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "suspended") {
    redirect("/login?error=suspended");
  }
  return profile;
}

/**
 * Requires an active profile whose role is in `roles`. Redirects to the
 * dashboard if the caller is active but unauthorized. Returns the profile so
 * actions can use org_id etc.
 */
export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireActiveProfile();
  if (!roles.includes(profile.role)) redirect("/app/dashboard");
  return profile;
}

/** Pure predicate — no redirect. Handy in UI to decide what to render. */
export function hasRole(profile: Profile | null, roles: UserRole[]): boolean {
  return !!profile && roles.includes(profile.role);
}
