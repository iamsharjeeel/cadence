"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/types/time-tracking";
import { PROJECT_PRESET_COLORS } from "@/types/time-tracking";

export type ActionResult = { ok: boolean; message: string; id?: string };

const HEX = /^#[0-9A-Fa-f]{6}$/;

export async function listProjects(orgId?: string): Promise<Project[]> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  let query = db.from("projects").select("*").eq("is_active", true).order("name");

  if (profile.role === "superadmin") {
    if (orgId) query = query.eq("org_id", orgId);
  } else if (profile.org_id) {
    query = query.eq("org_id", profile.org_id);
    if (profile.role === "employee") {
      query = query.or(`is_org_wide.eq.true,owner_id.eq.${profile.id}`);
    }
  } else {
    return [];
  }

  const { data } = await query;
  return (data ?? []) as Project[];
}

export async function createProject(payload: {
  name: string;
  color?: string;
  isOrgWide?: boolean;
  orgId?: string;
}): Promise<ActionResult> {
  const profile = await requireRole(["admin", "superadmin", "employee"]);
  if (!profile.org_id && profile.role !== "superadmin") {
    return { ok: false, message: "Your account has no organization." };
  }

  const name = payload.name.trim();
  if (!name || name.length > 80) {
    return { ok: false, message: "Project name is required (max 80 chars)." };
  }

  const color = payload.color?.trim() || PROJECT_PRESET_COLORS[0];
  if (!HEX.test(color)) return { ok: false, message: "Invalid color." };

  const isManager = profile.role === "admin" || profile.role === "superadmin";
  const isOrgWide = isManager ? Boolean(payload.isOrgWide) : false;
  const orgId =
    profile.role === "superadmin"
      ? payload.orgId?.trim() || profile.org_id
      : profile.org_id;

  if (!orgId) return { ok: false, message: "Select an organization." };
  if (!isManager && isOrgWide) {
    return { ok: false, message: "Only admins can create org-wide projects." };
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("projects")
    .insert({
      org_id: orgId,
      owner_id: isOrgWide ? null : profile.id,
      name,
      color,
      is_org_wide: isOrgWide,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: "Couldn't create project." };
  revalidatePath("/app/projects");
  revalidatePath("/app/timesheets");
  return { ok: true, message: "Project created.", id: data.id };
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (!project) return { ok: false, message: "Project not found." };

  const isManager =
    profile.role === "superadmin" ||
    (profile.role === "admin" && project.org_id === profile.org_id);
  const isOwner = project.owner_id === profile.id;

  if (!isManager && !isOwner) {
    return { ok: false, message: "Not authorized." };
  }
  if (!isManager && project.is_org_wide) {
    return { ok: false, message: "Org-wide projects can only be archived by admins." };
  }

  const { error } = await db
    .from("projects")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't archive project." };

  revalidatePath("/app/projects");
  revalidatePath("/app/timesheets");
  return { ok: true, message: "Project archived." };
}

export async function updateProject(payload: {
  id: string;
  name: string;
  color?: string;
}): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", payload.id)
    .single();
  if (!project) return { ok: false, message: "Project not found." };

  const isManager =
    profile.role === "superadmin" ||
    (profile.role === "admin" && project.org_id === profile.org_id);
  const isOwner = project.owner_id === profile.id;
  if (!isManager && !isOwner) return { ok: false, message: "Not authorized." };
  if (!isManager && project.is_org_wide) {
    return { ok: false, message: "Org-wide projects are read-only." };
  }

  const name = payload.name.trim();
  if (!name) return { ok: false, message: "Name is required." };
  const color = payload.color?.trim() || project.color;

  const { error } = await db
    .from("projects")
    .update({ name, color })
    .eq("id", payload.id);
  if (error) return { ok: false, message: "Couldn't update project." };

  revalidatePath("/app/projects");
  revalidatePath("/app/timesheets");
  return { ok: true, message: "Project updated." };
}
