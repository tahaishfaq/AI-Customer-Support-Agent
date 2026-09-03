import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { runDeferredOnboardingCrawl } from "@/lib/services/user-onboarding.service";

/** Fire-and-forget friendly: kick deferred website crawl after dashboard. */
export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const result = await runDeferredOnboardingCrawl(authResult.user.id);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("POST /api/onboarding/crawl", error);
    return NextResponse.json(
      { error: { message: "Unable to start crawl", details: {} } },
      { status: 500 }
    );
  }
}
