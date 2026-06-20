import { NextResponse } from "next/server";

import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const AVATARS_BUCKET = "avatars";

/** Signed URL redirect for private avatar uploads stored in the avatars bucket. */
export async function GET(request: Request) {
  const profile = await requireActiveProfile().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = new URL(request.url).searchParams.get("path");
  if (!path?.trim()) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  // Users may only fetch their own avatar object.
  if (!path.startsWith(`${profile.id}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  const { data, error } = await db.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
