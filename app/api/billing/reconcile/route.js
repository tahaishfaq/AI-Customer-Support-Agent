import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { normalizeCheckoutReference } from "@/lib/billing/checkout-reference";
import {
  reconcileCheckoutPayment,
  reconcileLatestCheckout,
} from "@/lib/billing/reconcile.service";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";
import { getConversationQuota } from "@/lib/billing/conversation-usage.service";

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const reference = normalizeCheckoutReference(body.reference);

    const subscriptionToken =
      typeof body.subscriptionToken === "string"
        ? body.subscriptionToken.trim()
        : null;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const result = reference
      ? await reconcileCheckoutPayment(authResult.user.id, reference, {
          subscriptionToken,
          ip,
        })
      : await reconcileLatestCheckout(authResult.user.id, { ip });

    const billing = await getBillingSnapshot(
      authResult.user.id,
      authResult.user.role
    );
    const conversations = await getConversationQuota(
      authResult.user.id,
      authResult.user.role || "USER",
      { billing }
    );

    return NextResponse.json(
      {
        ...result,
        billing,
        conversations,
      },
      { status: 200 }
    );
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("POST /api/billing/reconcile", error);
    }
    return NextResponse.json(
      {
        error: {
          message: error.message || "Unable to reconcile checkout",
          details: error.details || {},
        },
      },
      { status }
    );
  }
}
