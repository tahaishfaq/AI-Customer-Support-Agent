import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getAgentForUser } from "@/lib/services/agent.service";
import { cancelSimulationRun } from "@/lib/services/simulation.service";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id, runId } = await params;
    await getAgentForUser(id, authResult.user.id);
    const run = await cancelSimulationRun(runId, authResult.user.id);
    if (run.agentId && run.agentId !== id) {
      return NextResponse.json(
        { error: { message: "Not found", details: {} } },
        { status: 404 }
      );
    }
    return NextResponse.json({ run }, { status: 200 });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      {
        error: {
          message: error.message || "Unable to cancel simulation",
          details: {},
        },
      },
      { status: status === 403 || status === 404 ? status : 500 }
    );
  }
}
