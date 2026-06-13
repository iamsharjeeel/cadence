import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth";
import {
  deleteGCalConnection,
  getGCalConnection,
  revokeGCalToken,
} from "@/lib/google-calendar/connection";
import { decryptGCalToken } from "@/lib/google-calendar/crypto";

/**
 * Disconnects Google Calendar — revokes token and clears stored data.
 */
export async function POST() {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const connection = await getGCalConnection(profile.id);
    if (connection) {
      const accessToken = decryptGCalToken(connection.access_token_enc);
      if (accessToken) {
        await revokeGCalToken(accessToken).catch((err) => {
          console.error("[gcal/disconnect] revoke failed (continuing):", err);
        });
      }
    }

    await deleteGCalConnection(profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[gcal/disconnect]", err);
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Couldn't disconnect Google Calendar.",
      },
      { status: 500 },
    );
  }
}
