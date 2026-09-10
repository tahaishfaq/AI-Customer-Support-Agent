import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/require-auth";
import {
  revokeAllRealtimeSessions,
  revokeRealtimeSession,
} from "@/lib/realtime/session.service";

export async function POST(request) {
  const authResult = await requireFreshUser(request);
  if (authResult.error) return authResult.error;

  const body = await request.json().catch(() => ({}));
  if (body?.all === true) {
    await revokeAllRealtimeSessions(authResult.user.id);
    return NextResponse.json({ revoked: "all" });
  }

  if (!body?.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json(
      { error: { message: "sessionId is required unless all=true" } },
      { status: 400 }
    );
  }

  await revokeRealtimeSession({
    userId: authResult.user.id,
    sessionId: body.sessionId,
  });
  return NextResponse.json({ revoked: body.sessionId });
}
