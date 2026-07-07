import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth";
import { buildGmailAuthorizeUrl, isGmailConfigured } from "@/lib/gmail/config";

const STATE_COOKIE = "gmail_oauth_state";
const STATE_TTL_SEC = 600;

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!isGmailConfigured()) {
    return NextResponse.redirect(`${appUrl}/app/user-settings?gmail=error#section-connected`);
  }

  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.redirect(new URL("/login?error=gmail_auth", appUrl));
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

    return NextResponse.redirect(buildGmailAuthorizeUrl(state));
  } catch (err) {
    console.error("[gmail/connect]", err);
    return NextResponse.redirect(`${appUrl}/app/user-settings?gmail=error#section-connected`);
  }
}
