import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { listAgentRevisionsForUser } from "@/lib/services/agent-revision.service";

/** Level 2 · P5 — version history (newest first). */
export async function GET(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    const { id } = await params;
    return NextResponse.json(await listAgentRevisionsForUser(id, authResult.user.id), { status: 200 });
  } catch (error) {
    if ([403, 404].includes(error.status)) {
      return NextResponse.json({ error: { message: error.message, details: {} } }, { status: error.status });
    }
    console.error("GET /api/agents/[id]/revisions", error?.status || error?.message);
    return NextResponse.json({ error: { message: "Unable to load versions", details: {} } }, { status: 500 });
  }
}
