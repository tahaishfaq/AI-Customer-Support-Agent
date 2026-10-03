import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getAgentForUser } from "@/lib/services/agent.service";
import prisma from "@/lib/prisma";
import { normalizeAbTest, abReadyToStop } from "@/lib/ab/bucket";

/** Sample counts for A/B buckets (embed conversations). */
export async function GET(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const agent = await getAgentForUser(id, authResult.user.id);
    const config = normalizeAbTest(agent.abTest);

    const [samplesA, samplesB] = await Promise.all([
      prisma.conversation.count({
        where: { agentId: id, source: "EMBED", abBucket: "A" },
      }),
      prisma.conversation.count({
        where: { agentId: id, source: "EMBED", abBucket: "B" },
      }),
    ]);

    return NextResponse.json(
      {
        samplesA,
        samplesB,
        minSample: config.minSample,
        readyToStop: abReadyToStop({
          samplesA,
          samplesB,
          minSample: config.minSample,
        }),
        enabled: config.enabled,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("GET /api/agents/[id]/ab-stats", error);
    return NextResponse.json(
      { error: { message: "Unable to load A/B stats" } },
      { status: 500 }
    );
  }
}
