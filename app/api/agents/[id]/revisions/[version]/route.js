import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getAgentRevisionForUser } from "@/lib/services/agent-revision.service";

/** Level 2 · P5 — one saved version (for viewing and comparing). */
export async function GET(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    const { id, version } = await params;
    return NextResponse.json(await getAgentRevisionForUser(id, authResult.user.id, version), { status: 200 });
  } catch (error) {
    if ([400, 403, 404].includes(error.status)) {
      return NextResponse.json({ error: { message: error.message, details: {} } }, { status: error.status });
    }
    console.error("GET /api/agents/[id]/revisions/[version]", error?.status || error?.message);
    return NextResponse.json({ error: { message: "Unable to load version", details: {} } }, { status: 500 });
  }
}
