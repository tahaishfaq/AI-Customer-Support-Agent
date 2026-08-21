import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getAgentForUser } from "@/lib/services/agent.service";
import { rotateAgentPublicKey } from "@/lib/services/embed.service";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const limited = rateLimit(
      `embed-regen:${authResult.user.id}:${id}`,
      { limit: 6, windowMs: 60_000 }
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many regenerations. Try again shortly."
      );
    }

    const agent = await getAgentForUser(id, authResult.user.id);
    const updated = await rotateAgentPublicKey(agent);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/agents/[id]/embed/regenerate", error);
    return NextResponse.json(
      { error: { message: "Unable to regenerate embed", details: {} } },
      { status: 500 }
    );
  }
}
