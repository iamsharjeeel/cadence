import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getProfile } from "@/lib/auth";
import { exchangeAsanaCode } from "@/lib/asana/config";
import { upsertAsanaConnection } from "@/lib/asana/connection";

const STATE_COOKIE = "asana_oauth_state";

/**
 * Asana OAuth callback — exchanges code for tokens and stores per-user connection.
 * Registered redirect URI: /api/asana/callback
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const profileUrl = `${appUrl}/app/profile`;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError || !code || !state) {
    console.error("[asana/callback] OAuth error or missing params:", oauthError);
    return NextResponse.redirect(`${profileUrl}?asana=error`);
  }

  const cookieStore = cookies();
  const rawCookie = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!rawCookie) {
    console.error("[asana/callback] Missing state cookie");
    return NextResponse.redirect(`${profileUrl}?asana=error`);
  }

  let stored: { state: string; userId: string };
  try {
    stored = JSON.parse(rawCookie) as { state: string; userId: string };
  } catch {
    console.error("[asana/callback] Invalid state cookie");
    return NextResponse.redirect(`${profileUrl}?asana=error`);
  }

  if (stored.state !== state) {
    console.error("[asana/callback] State mismatch");
    return NextResponse.redirect(`${profileUrl}?asana=error`);
  }

  const profile = await getProfile();
  if (!profile || profile.status !== "active" || profile.id !== stored.userId) {
    console.error("[asana/callback] Session user mismatch");
    return NextResponse.redirect(`${appUrl}/login?error=asana_session`);
  }

  try {
    const tokens = await exchangeAsanaCode(code);
    await upsertAsanaConnection(profile.id, tokens);
    return NextResponse.redirect(`${profileUrl}?asana=connected`);
  } catch (err) {
    console.error("[asana/callback] Token exchange failed:", err);
    return NextResponse.redirect(`${profileUrl}?asana=error`);
  }
}
