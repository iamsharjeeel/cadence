import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { UserDocument } from "@/types/db";

export type UserDocumentRow = UserDocument;

export async function listUserDocumentsForOwner(
  ownerId: string,
): Promise<UserDocumentRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("user_documents")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as UserDocumentRow[];
}

export async function signedUrlsForUserDocuments(
  docs: Pick<UserDocumentRow, "id" | "file_path">[],
): Promise<Record<string, string>> {
  const db = createAdminClient();
  const urls: Record<string, string> = {};
  await Promise.all(
    docs.map(async (d) => {
      const { data: signed } = await db.storage
        .from("documents")
        .createSignedUrl(d.file_path, 60 * 60);
      if (signed?.signedUrl) urls[d.id] = signed.signedUrl;
    }),
  );
  return urls;
}

export type OrgMemberOption = { id: string; name: string };

export async function listOrgMembersForAssign(
  orgId: string,
  excludeUserId?: string,
): Promise<OrgMemberOption[]> {
  const db = createAdminClient();
  const { data: memRows } = await db
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId);

  const memberIds = (memRows ?? [])
    .map((m) => m.user_id as string)
    .filter((id) => id !== excludeUserId);

  if (!memberIds.length) return [];

  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", memberIds)
    .order("full_name");

  return (people ?? []).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || p.email,
  }));
}
