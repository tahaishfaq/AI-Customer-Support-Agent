import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  countWaitingForUser,
  getDeskStatsForUser,
} from "@/lib/services/handoff.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "count";

    if (mode === "stats") {
      const days = Number(searchParams.get("days") || 7);
      const stats = await getDeskStatsForUser(authResult.user.id, { days });
      return NextResponse.json(stats, { status: 200 });
    }

    const result = await countWaitingForUser(authResult.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("GET /api/inbox/count", error);
    return NextResponse.json(
      { error: { message: "Unable to load inbox count", details: {} } },
      { status: 500 }
    );
  }
}
