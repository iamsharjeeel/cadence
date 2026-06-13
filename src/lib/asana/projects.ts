import "server-only";

import {
  asanaApiGet,
  type AsanaProject,
  type AsanaWorkspace,
} from "@/lib/asana/config";
import { getValidAsanaAccessToken } from "@/lib/asana/connection";

export type AsanaProjectOption = {
  gid: string;
  name: string;
  workspaceGid: string;
  workspaceName: string;
};

type AsanaListResponse<T> = { data: T[] };

export async function fetchAsanaWorkspaces(
  accessToken: string,
): Promise<AsanaWorkspace[]> {
  const res = await asanaApiGet<AsanaListResponse<AsanaWorkspace>>(
    "/workspaces",
    accessToken,
  );
  return res.data ?? [];
}

export async function fetchAsanaProjectsInWorkspace(
  accessToken: string,
  workspaceGid: string,
): Promise<AsanaProject[]> {
  const params = new URLSearchParams({
    workspace: workspaceGid,
    archived: "false",
    opt_fields: "name,gid,workspace.name,workspace.gid",
  });
  const res = await asanaApiGet<AsanaListResponse<AsanaProject>>(
    `/projects?${params.toString()}`,
    accessToken,
  );
  return res.data ?? [];
}

/** Lists all non-archived projects across every workspace the user belongs to. */
export async function fetchAllAsanaProjects(
  userId: string,
): Promise<AsanaProjectOption[]> {
  const accessToken = await getValidAsanaAccessToken(userId);
  const workspaces = await fetchAsanaWorkspaces(accessToken);
  const projects: AsanaProjectOption[] = [];

  for (const workspace of workspaces) {
    const workspaceProjects = await fetchAsanaProjectsInWorkspace(
      accessToken,
      workspace.gid,
    );
    for (const project of workspaceProjects) {
      projects.push({
        gid: project.gid,
        name: project.name,
        workspaceGid: project.workspace?.gid ?? workspace.gid,
        workspaceName: project.workspace?.name ?? workspace.name,
      });
    }
  }

  projects.sort((a, b) =>
    a.workspaceName.localeCompare(b.workspaceName) ||
    a.name.localeCompare(b.name),
  );

  return projects;
}
