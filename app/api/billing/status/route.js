import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";
import { getConversationQuota } from "@/lib/billing/conversation-usage.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const billing = await getBillingSnapshot(
      authResult.user.id,
      authResult.user.role
    );
    const conversations = await getConversationQuota(
      authResult.user.id,
      authResult.user.role || "USER",
      { billing }
    );

    return NextResponse.json({ billing, conversations }, { status: 200 });
  } catch (error) {
    console.error("GET /api/billing/status", error);
    return NextResponse.json(
      { error: { message: "Unable to load billing status", details: {} } },
      { status: 500 }
    );
  }
}
