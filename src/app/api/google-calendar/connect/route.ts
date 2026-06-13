import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth";
import { buildGoogleCalendarAuthorizeUrl } from "@/lib/google-calendar/config";

const STATE_COOKIE = "gcal_oauth_state";
const STATE_TTL_SEC = 600;

/**
 * Starts the Google Calendar OAuth flow for the signed-in user.
 */
export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.redirect(
      new URL(
        "/login?error=gcal_auth",
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      ),
    );
  }

  try {
    const state = randomBytes(24).toString("hex");
    const cookieStore = cookies();
    cookieStore.set(
      STATE_COOKIE,
      JSON.stringify({ state, userId: profile.id }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: STATE_TTL_SEC,
        path: "/",
      },
    );

    const authorizeUrl = buildGoogleCalendarAuthorizeUrl(state);
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    console.error("[gcal/connect]", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/app/profile?gcal=error#section-connected`);
  }
}
