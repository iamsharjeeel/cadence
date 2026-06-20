"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import {
  deleteAsanaConnection,
  getAsanaConnection,
  getValidAsanaAccessToken,
} from "@/lib/asana/connection";
import { decryptAsanaToken } from "@/lib/asana-crypto";
import { revokeAsanaToken } from "@/lib/asana/config";
import { fetchAllAsanaProjects } from "@/lib/asana/projects";
import {
  ASANA_RECONNECT_MESSAGE,
  isAsanaInsufficientScopeError,
} from "@/lib/asana/errors";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import type { AsanaImportedProject } from "@/types/db";

export type ActionResult = { ok: boolean; message: string; needsReconnect?: boolean };

function asanaActionError(err: unknown): ActionResult {
  if (isAsanaInsufficientScopeError(err)) {
    return { ok: false, message: ASANA_RECONNECT_MESSAGE, needsReconnect: true };
  }
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Asana request failed.",
  };
}

export type AsanaProjectForImport = {
  gid: string;
  name: string;
  workspaceGid: string;
  workspaceName: string;
  alreadyImported: boolean;
};

export async function listAsanaProjectsForImport(): Promise<
  ActionResult & { projects?: AsanaProjectForImport[] }
> {
  const profile = await requireActiveProfile();

  try {
    const [remoteProjects, imported] = await Promise.all([
      fetchAllAsanaProjects(profile.id),
      listImportedAsanaProjects(profile.id),
    ]);

    const importedGids = new Set(imported.map((p) => p.asana_project_gid));

    return {
      ok: true,
      message: "Projects loaded.",
      projects: remoteProjects.map((p) => ({
        gid: p.gid,
        name: p.name,
        workspaceGid: p.workspaceGid,
        workspaceName: p.workspaceName,
        alreadyImported: importedGids.has(p.gid),
      })),
    };
  } catch (err) {
    console.error("[asana] list projects failed:", err);
    return asanaActionError(err);
  }
}

export async function importAsanaProjects(
  projectGids: string[],
): Promise<ActionResult> {
  const profile = await requireActiveProfile();

  if (!projectGids.length) {
    return { ok: false, message: "Select at least one project." };
  }

  if (projectGids.length > 100) {
    return { ok: false, message: "Select up to 100 projects at a time." };
  }

  try {
    const remoteProjects = await fetchAllAsanaProjects(profile.id);
    const selected = remoteProjects.filter((p) => projectGids.includes(p.gid));

    if (!selected.length) {
      return { ok: false, message: "No matching projects found in Asana." };
    }

    const supabase = createClient();
    const rows = selected.map((p) => ({
      user_id: profile.id,
      asana_project_gid: p.gid,
      asana_project_name: p.name,
      asana_workspace_gid: p.workspaceGid,
      asana_workspace_name: p.workspaceName,
    }));

    const { error } = await supabase.from("asana_imported_projects").upsert(
      rows,
      { onConflict: "user_id,asana_project_gid" },
    );

    if (error) {
      console.error("[asana] import upsert failed:", error.message);
      return { ok: false, message: "Couldn't import projects." };
    }

    await markAsanaProjectNamesSynced(profile.id);

    revalidatePath("/app/profile");
    revalidatePath("/app/projects");
    return {
      ok: true,
      message: `Imported ${selected.length} project${selected.length === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    console.error("[asana] import failed:", err);
    return asanaActionError(err);
  }
}

export async function removeImportedAsanaProject(
  projectId: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from("asana_imported_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", profile.id);

  if (error) {
    console.error("[asana] remove imported failed:", error.message);
    return { ok: false, message: "Couldn't remove project." };
  }

  revalidatePath("/app/profile");
  revalidatePath("/app/projects");
  return { ok: true, message: "Project removed from your list." };
}

export async function syncImportedAsanaProjectNames(): Promise<ActionResult> {
  const profile = await requireActiveProfile();

  try {
    const [remoteProjects, imported] = await Promise.all([
      fetchAllAsanaProjects(profile.id),
      listImportedAsanaProjects(profile.id),
    ]);

    if (!imported.length) {
      return { ok: true, message: "No imported projects to sync." };
    }

    const remoteByGid = new Map(remoteProjects.map((p) => [p.gid, p]));
    const supabase = createClient();
    let updated = 0;

    for (const row of imported) {
      const remote = remoteByGid.get(row.asana_project_gid);
      if (!remote) continue;
      if (
        remote.name === row.asana_project_name &&
        remote.workspaceName === (row.asana_workspace_name ?? "")
      ) {
        continue;
      }

      const { error } = await supabase
        .from("asana_imported_projects")
        .update({
          asana_project_name: remote.name,
          asana_workspace_name: remote.workspaceName,
        })
        .eq("id", row.id)
        .eq("user_id", profile.id);

      if (!error) updated += 1;
    }

    await markAsanaProjectNamesSynced(profile.id);

    revalidatePath("/app/profile");
    revalidatePath("/app/projects");
    revalidatePath("/app/timesheets");
    revalidatePath("/app/timesheets/log");
    return {
      ok: true,
      message:
        updated > 0
          ? `Updated ${updated} project name${updated === 1 ? "" : "s"}.`
          : "All project names are up to date.",
    };
  } catch (err) {
    console.error("[asana] sync names failed:", err);
    return asanaActionError(err);
  }
}

export async function disconnectAsana(): Promise<ActionResult> {
  const profile = await requireActiveProfile();

  try {
    const connection = await getAsanaConnection(profile.id);
    if (connection) {
      const accessToken = decryptAsanaToken(connection.access_token_enc);
      if (accessToken) {
        await revokeAsanaToken(accessToken).catch((err) => {
          console.error("[asana] revoke failed (continuing):", err);
        });
      }
    }

    await deleteAsanaConnection(profile.id);
    revalidatePath("/app/profile");
    revalidatePath("/app/projects");
    return { ok: true, message: "Asana disconnected." };
  } catch (err) {
    console.error("[asana] disconnect failed:", err);
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't disconnect Asana.",
    };
  }
}

/** Public server action: returns the current user's imported Asana projects. */
export async function getMyImportedAsanaProjects(): Promise<AsanaImportedProject[]> {
  const profile = await requireActiveProfile();
  return listImportedAsanaProjects(profile.id);
}

async function listImportedAsanaProjects(
  userId: string,
): Promise<AsanaImportedProject[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("asana_imported_projects")
    .select("*")
    .eq("user_id", userId)
    .order("asana_project_name");

  if (error) {
    console.error("[asana] imported list failed:", error.message);
    return [];
  }
  return (data ?? []) as AsanaImportedProject[];
}

async function markAsanaProjectNamesSynced(userId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("asana_connections")
    .update({
      project_names_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[asana] project_names_synced_at update failed:", error.message);
  }
}

/** Opportunistic health check — tries token refresh; notifies once if auth fails. */
export async function checkAsanaConnectionHealth(): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  if (!profile.org_id) return { ok: true, message: "" };

  const connection = await getAsanaConnection(profile.id);
  if (!connection) return { ok: true, message: "" };

  try {
    await getValidAsanaAccessToken(profile.id);
    return { ok: true, message: "" };
  } catch (err) {
    console.error("[asana] connection health check failed:", err);

    const db = createAdminClient();
    const { data: existing } = await db
      .from("notifications")
      .select("id")
      .eq("user_id", profile.id)
      .eq("type", "asana_reconnect_required")
      .eq("read", false)
      .limit(1);

    if (existing && existing.length > 0) {
      return { ok: true, message: "" };
    }

    await notifyUser({
      orgId: profile.org_id,
      userId: profile.id,
      type: "asana_reconnect_required",
      title: "Your Asana connection needs to be reconnected",
      body: "Open Connected accounts on your profile to reconnect.",
      entity: "profile",
      entityId: profile.id,
    });

    return { ok: true, message: "Reconnect notification sent." };
  }
}
