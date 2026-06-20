"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext, type WorkspaceContext } from "@/lib/workspace";
import type { Project } from "@/types/time-tracking";
import { PROJECT_PRESET_COLORS } from "@/types/time-tracking";
import type { AsanaImportedProject } from "@/types/db";

export type ActionResult = { ok: boolean; message: string; id?: string };

export type ProjectListItem = Project & {
  scope: "org" | "personal" | "asana";
  canEdit: boolean;
  source: "cadence" | "asana";
  asana_project_gid: string | null;
  asana_workspace_name: string | null;
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

function projectPermissions(
  project: Project,
  ctx: WorkspaceContext,
): { canEdit: boolean } {
  const userId = ctx.realProfile.id;
  const canManageAsOwner = project.owner_id === userId;
  const canManageAsOrgAdmin =
    project.is_org_wide &&
    ctx.activeOrgId != null &&
    project.org_id === ctx.activeOrgId &&
    (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin");

  return { canEdit: canManageAsOwner || canManageAsOrgAdmin };
}

function canCreateInContext(ctx: WorkspaceContext): boolean {
  if (!ctx.activeOrgId) return true;
  return ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin";
}

/** Org-wide projects + the current user's personal projects (for time entry dropdown). */
export async function fetchProjectsForTimeEntry(
  orgId: string | null,
  userId: string,
): Promise<Project[]> {
  const db = createAdminClient();

  if (!orgId) {
    const { data: personal } = await db
      .from("projects")
      .select("*")
      .is("org_id", null)
      .eq("is_active", true)
      .eq("owner_id", userId)
      .order("name");
    return (personal ?? []) as Project[];
  }

  const [{ data: orgWide }, { data: personal }] = await Promise.all([
    db
      .from("projects")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .eq("is_org_wide", true)
      .order("name"),
    db
      .from("projects")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .eq("owner_id", userId)
      .order("name"),
  ]);

  const byId = new Map<string, Project>();
  for (const p of [...(orgWide ?? []), ...(personal ?? [])] as Project[]) {
    byId.set(p.id, p);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listProjects(): Promise<ProjectListItem[]> {
  await requireActiveProfile();
  const ctx = await getWorkspaceContext();
  if (!ctx) return [];

  const db = createAdminClient();
  const userId = ctx.realProfile.id;
  const activeOrgId = ctx.activeOrgId;

  let projects: Project[] = [];
  let asanaProjects: AsanaImportedProject[] = [];

  if (!activeOrgId) {
    const { data } = await db
      .from("projects")
      .select("*")
      .is("org_id", null)
      .eq("owner_id", userId)
      .eq("is_active", true)
      .order("name");
    projects = (data ?? []) as Project[];
  } else {
    const [{ data: orgWide }, { data: personal }] = await Promise.all([
      db
        .from("projects")
        .select("*")
        .eq("org_id", activeOrgId)
        .eq("is_active", true)
        .eq("is_org_wide", true)
        .order("name"),
      db
        .from("projects")
        .select("*")
        .eq("org_id", activeOrgId)
        .eq("is_active", true)
        .eq("owner_id", userId)
        .order("name"),
    ]);
    const byId = new Map<string, Project>();
    for (const p of [...(orgWide ?? []), ...(personal ?? [])] as Project[]) {
      byId.set(p.id, p);
    }
    projects = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  const { data: importedAsana } = await db
    .from("asana_imported_projects")
    .select("*")
    .eq("user_id", userId)
    .order("asana_project_name");

  asanaProjects = (importedAsana ?? []) as AsanaImportedProject[];

  const cadenceItems: ProjectListItem[] = projects.map((project) => ({
    ...project,
    scope: project.is_org_wide ? ("org" as const) : ("personal" as const),
    canEdit: projectPermissions(project, ctx).canEdit,
    source: "cadence",
    asana_project_gid: null,
    asana_workspace_name: null,
  }));

  const asanaItems: ProjectListItem[] = asanaProjects.map((project) => ({
    id: project.id,
    org_id: null,
    owner_id: project.user_id,
    name: project.asana_project_name,
    color: "#F06A6A",
    description: null,
    client_name: project.asana_workspace_name,
    billable_default: true,
    is_org_wide: false,
    is_active: true,
    created_at: project.imported_at,
    scope: "asana",
    canEdit: false,
    source: "asana",
    asana_project_gid: project.asana_project_gid,
    asana_workspace_name: project.asana_workspace_name,
  }));

  return [...cadenceItems, ...asanaItems].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function getProjectsPageContext(): Promise<{
  canCreate: boolean;
  inOrg: boolean;
}> {
  const ctx = await getWorkspaceContext();
  return {
    canCreate: ctx ? canCreateInContext(ctx) : false,
    inOrg: Boolean(ctx?.activeOrgId),
  };
}

export async function createProject(payload: {
  name: string;
  color?: string;
  description?: string;
  clientName?: string;
  billableDefault?: boolean;
}): Promise<ActionResult> {
  await requireActiveProfile();
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const name = payload.name.trim();
  if (!name || name.length > 80) {
    return { ok: false, message: "Project name is required (max 80 chars)." };
  }

  const color = payload.color?.trim() || PROJECT_PRESET_COLORS[0];
  if (!HEX.test(color)) return { ok: false, message: "Invalid color." };

  const description = payload.description?.trim() || null;
  const clientName = payload.clientName?.trim() || null;
  const billableDefault = payload.billableDefault ?? true;
  const activeOrgId = ctx.activeOrgId;

  if (activeOrgId) {
    if (ctx.workspaceRole !== "owner" && ctx.workspaceRole !== "admin") {
      return {
        ok: false,
        message: "Only owners and managers can create organization projects.",
      };
    }
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("projects")
    .insert({
      org_id: activeOrgId,
      owner_id: activeOrgId ? null : ctx.realProfile.id,
      name,
      color,
      description,
      client_name: clientName,
      billable_default: billableDefault,
      is_org_wide: Boolean(activeOrgId),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: "Couldn't create project." };
  revalidatePath("/app/projects");
  revalidatePath("/app/timesheets");
  return { ok: true, message: "Project created.", id: data.id };
}

export async function updateProject(payload: {
  id: string;
  name: string;
  color?: string;
  description?: string;
  clientName?: string;
  billableDefault?: boolean;
}): Promise<ActionResult> {
  await requireActiveProfile();
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", payload.id)
    .single();
  if (!project) return { ok: false, message: "Project not found." };

  const { canEdit } = projectPermissions(project as Project, ctx);
  if (!canEdit) return { ok: false, message: "Not authorized." };

  const name = payload.name.trim();
  if (!name || name.length > 80) {
    return { ok: false, message: "Project name is required (max 80 chars)." };
  }

  const color = payload.color?.trim() || project.color;
  if (!HEX.test(color)) return { ok: false, message: "Invalid color." };

  const { error } = await db
    .from("projects")
    .update({
      name,
      color,
      description: payload.description?.trim() || null,
      client_name: payload.clientName?.trim() || null,
      billable_default: payload.billableDefault ?? project.billable_default,
    })
    .eq("id", payload.id);

  if (error) return { ok: false, message: "Couldn't update project." };

  revalidatePath("/app/projects");
  revalidatePath("/app/timesheets");
  return { ok: true, message: "Project updated." };
}

export async function archiveProject(id: string): Promise<ActionResult> {
  await requireActiveProfile();
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (!project) return { ok: false, message: "Project not found." };

  const { canEdit } = projectPermissions(project as Project, ctx);
  if (!canEdit) return { ok: false, message: "Not authorized." };

  const { error } = await db
    .from("projects")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't archive project." };

  revalidatePath("/app/projects");
  revalidatePath("/app/timesheets");
  return { ok: true, message: "Project archived." };
}
