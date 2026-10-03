import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";
import prisma from "@/lib/prisma";
import {
  CHARGE_STATUS,
  monthUtcBounds,
} from "@/lib/billing/resolution-charge";

/** Level 3 · L5 — monthly resolution charge usage for the signed-in owner. */
export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const billing = await getBillingSnapshot(
      authResult.user.id,
      authResult.user.role
    );
    const plan = billing?.subscription?.plan;
    const enabled = Boolean(plan?.resolutionPricingEnabled);
    if (!enabled) {
      return NextResponse.json({ enabled: false }, { status: 200 });
    }

    const { start, end } = monthUtcBounds();
    const [chargedCount, reversedCount] = await Promise.all([
      prisma.resolutionCharge.count({
        where: {
          userId: authResult.user.id,
          status: CHARGE_STATUS.CHARGED,
          chargedAt: { gte: start, lt: end },
        },
      }),
      prisma.resolutionCharge.count({
        where: {
          userId: authResult.user.id,
          status: CHARGE_STATUS.REVERSED,
          reversedAt: { gte: start, lt: end },
        },
      }),
    ]);

    const unitPriceMinor = Number(plan.resolutionPriceMinor) || 0;
    const currency = plan.currency || "USD";

    return NextResponse.json(
      {
        enabled: true,
        chargedCount,
        reversedCount,
        maxPerMonth: Number(plan.maxResolutionsPerMonth) || 0,
        unitPriceMinor,
        currency,
        estimatedMinor: chargedCount * unitPriceMinor,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/billing/resolution-usage", error);
    return NextResponse.json(
      { error: { message: "Unable to load resolution usage", details: {} } },
      { status: 500 }
    );
  }
}
