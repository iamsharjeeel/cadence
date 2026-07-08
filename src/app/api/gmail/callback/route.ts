import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getProfile } from "@/lib/auth";
import { timingSafeStringEqual } from "@/lib/timing-safe";
import { exchangeGmailCode } from "@/lib/gmail/config";
import { upsertGmailConnection } from "@/lib/gmail/connection";

const STATE_COOKIE = "gmail_oauth_state";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const settingsUrl = `${appUrl}/app/user-settings`;
  const profileUrl = `${settingsUrl}?gmail=connected#section-connected`;
  const errorUrl = `${settingsUrl}?gmail=error#section-connected`;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError || !code || !state) {
    console.error("[gmail/callback] OAuth error or missing params:", oauthError);
    return NextResponse.redirect(errorUrl);
  }

  const cookieStore = cookies();
  const rawCookie = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!rawCookie) {
    console.error("[gmail/callback] Missing state cookie");
    return NextResponse.redirect(errorUrl);
  }

  let stored: { state: string; userId: string };
  try {
    stored = JSON.parse(rawCookie) as { state: string; userId: string };
  } catch {
    console.error("[gmail/callback] Invalid state cookie");
    return NextResponse.redirect(errorUrl);
  }

  if (!timingSafeStringEqual(stored.state, state)) {
    console.error("[gmail/callback] State mismatch");
    return NextResponse.redirect(errorUrl);
  }

  const profile = await getProfile();
  if (!profile || profile.status !== "active" || profile.id !== stored.userId) {
    console.error("[gmail/callback] Session user mismatch");
    return NextResponse.redirect(`${appUrl}/login?error=gmail_session`);
  }

  try {
    const tokens = await exchangeGmailCode(code);

    let gmailEmail: string | null = null;
    try {
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          cache: "no-store",
        },
      );
      if (userInfoRes.ok) {
        const userInfo = (await userInfoRes.json()) as { email?: string };
        gmailEmail = userInfo.email ?? null;
      }
    } catch (err) {
      console.error("[gmail/callback] userinfo fetch failed:", err);
    }

    await upsertGmailConnection(profile.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      gmailEmail,
    });

    return NextResponse.redirect(profileUrl);
  } catch (err) {
    console.error("[gmail/callback] Token exchange failed:", err);
    return NextResponse.redirect(errorUrl);
  }
}
