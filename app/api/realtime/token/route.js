import { NextResponse } from "next/server";
import { requireFreshUser } from "@/lib/require-auth";
import { getRealtimeConfig } from "@/lib/realtime/config";
import { issueOwnerRealtimeSession } from "@/lib/realtime/session.service";

export async function POST(request) {
  const authResult = await requireFreshUser(request);
  if (authResult.error) return authResult.error;

  const config = getRealtimeConfig();
  const enabled = Boolean(
    config.enabled &&
      config.url &&
      (config.deskEnabled || config.billingEnabled)
  );
  if (!enabled) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Device label is optional; an empty body is valid.
  }

  try {
    const result = await issueOwnerRealtimeSession({
      userId: authResult.user.id,
      deviceLabel: body?.deviceLabel,
    });
    return NextResponse.json(
      {
        ...result,
        userId: authResult.user.id,
        userName: authResult.user.name || "Team member",
        enabled: true,
        realtimeUrl: config.url,
      },
      { status: 201 }
    );
  } catch (error) {
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      { error: { message: status === 500 ? "Unable to issue realtime token" : error.message } },
      { status }
    );
  }
}
