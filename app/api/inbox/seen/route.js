import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { markDeskInboxSeen } from "@/lib/services/handoff.service";

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const result = await markDeskInboxSeen(authResult.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/inbox/seen", error);
    return NextResponse.json(
      { error: { message: "Unable to mark inbox as read", details: {} } },
      { status: 500 }
    );
  }
}
