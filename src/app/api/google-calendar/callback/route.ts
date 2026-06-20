import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getProfile } from "@/lib/auth";
import { exchangeGoogleCalendarCode } from "@/lib/google-calendar/config";
import { upsertGCalConnection } from "@/lib/google-calendar/connection";

const STATE_COOKIE = "gcal_oauth_state";

/**
 * Google Calendar OAuth callback — exchanges code for tokens and stores connection.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const settingsUrl = `${appUrl}/app/user-settings`;
  const profileUrl = `${settingsUrl}?gcal=connected#section-connected`;
  const errorUrl = `${settingsUrl}?gcal=error#section-connected`;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError || !code || !state) {
    console.error("[gcal/callback] OAuth error or missing params:", oauthError);
    return NextResponse.redirect(errorUrl);
  }

  const cookieStore = cookies();
  const rawCookie = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!rawCookie) {
    console.error("[gcal/callback] Missing state cookie");
    return NextResponse.redirect(errorUrl);
  }

  let stored: { state: string; userId: string };
  try {
    stored = JSON.parse(rawCookie) as { state: string; userId: string };
  } catch {
    console.error("[gcal/callback] Invalid state cookie");
    return NextResponse.redirect(errorUrl);
  }

  if (stored.state !== state) {
    console.error("[gcal/callback] State mismatch");
    return NextResponse.redirect(errorUrl);
  }

  const profile = await getProfile();
  if (!profile || profile.status !== "active" || profile.id !== stored.userId) {
    console.error("[gcal/callback] Session user mismatch");
    return NextResponse.redirect(`${appUrl}/login?error=gcal_session`);
  }

  try {
    const tokens = await exchangeGoogleCalendarCode(code);

    let googleEmail: string | null = null;
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
        googleEmail = userInfo.email ?? null;
      }
    } catch (err) {
      console.error("[gcal/callback] userinfo fetch failed:", err);
    }

    await upsertGCalConnection(profile.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      googleEmail,
    });

    return NextResponse.redirect(profileUrl);
  } catch (err) {
    console.error("[gcal/callback] Token exchange failed:", err);
    return NextResponse.redirect(errorUrl);
  }
}
