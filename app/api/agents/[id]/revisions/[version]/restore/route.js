import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { restoreAgentRevisionForUser } from "@/lib/services/agent-revision.service";

/** Level 2 · P5 — restore a version (saved as a new version; history is never rewritten). */
export async function POST(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    const { id, version } = await params;
    const result = await restoreAgentRevisionForUser(id, authResult.user.id, version);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if ([400, 402, 403, 404, 409, 422].includes(error.status)) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/agents/[id]/revisions/[version]/restore", error?.status || error?.message);
    return NextResponse.json({ error: { message: "Unable to restore version", details: {} } }, { status: 500 });
  }
}
