import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import prisma from "@/lib/prisma";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";

const RANGES = new Set(["7d", "30d", "all"]);

/** CX trend + risky (ungrounded) answers for the active workspace. */
export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const workspace = await resolveActiveWorkspace(authResult.user.id);
    const params = request.nextUrl.searchParams;
    const agentId = params.get("agentId") || undefined;
    const rangeParam = params.get("range");
    const range = RANGES.has(rangeParam) ? rangeParam : "30d";

    const since =
      range === "all"
        ? null
        : new Date(Date.now() - (range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);

    const where = {
      status: "OK",
      conversation: {
        agent: {
          workspaceId: workspace.id,
          ...(agentId ? { id: agentId } : {}),
        },
        source: { not: "STUDIO" },
      },
      ...(since ? { scoredAt: { gte: since } } : {}),
    };

    const rows = await prisma.conversationQa.findMany({
      where,
      orderBy: { scoredAt: "asc" },
      take: 500,
      select: {
        id: true,
        conversationId: true,
        cxScore: true,
        grounded: true,
        issues: true,
        scoredAt: true,
      },
    });

    const trend = rows
      .filter((row) => Number.isFinite(row.cxScore))
      .map((row) => ({
        at: row.scoredAt,
        cxScore: row.cxScore,
        conversationId: row.conversationId,
      }));

    const risky = [];
    for (const row of rows) {
      const grounded = Array.isArray(row.grounded) ? row.grounded : [];
      for (const claim of grounded) {
        if (claim && claim.grounded === false) {
          risky.push({
            conversationId: row.conversationId,
            claim: String(claim.claim || "").slice(0, 300),
            scoredAt: row.scoredAt,
          });
        }
      }
    }

    const avg =
      trend.length === 0
        ? null
        : Math.round(trend.reduce((sum, row) => sum + row.cxScore, 0) / trend.length);

    return NextResponse.json(
      {
        range,
        averageCxScore: avg,
        scoredCount: trend.length,
        trend,
        riskyAnswers: risky.slice(-50).reverse(),
      },
      { status: 200 }
    );
  } catch (error) {
    return handleAnalyticsError("GET /api/analytics/qa", error, request);
  }
}
