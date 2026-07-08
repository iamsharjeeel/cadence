import { NextResponse } from "next/server";

import { processWebhookRetries } from "@/lib/webhook-dispatcher";
import { timingSafeStringEqual } from "@/lib/timing-safe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || !auth || !timingSafeStringEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processed = await processWebhookRetries();
  return NextResponse.json({ ok: true, processed });
}
