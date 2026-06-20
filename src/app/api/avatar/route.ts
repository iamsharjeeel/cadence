import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a signed URL (1-hour expiry). RLS on storage.objects allows any
  // authenticated user to read the avatars bucket, so createSignedUrl succeeds
  // for any valid path when the caller is signed in.
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Redirect to the signed URL. Cache for 55 minutes so browsers don't
  // re-hit this route on every render but don't serve an expired signed URL.
  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: { "Cache-Control": "private, max-age=3300" },
  });
}
