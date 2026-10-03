import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  getAgentForUser,
  resolveAgentWorkspaceAccess,
} from "@/lib/services/agent.service";
import {
  listKnowledgeSuggestions,
  refreshKnowledgeSuggestions,
} from "@/lib/services/ai/knowledge-suggestion.service";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id } = await params;
    const agent = await getAgentForUser(id, authResult.user.id);
    const access = await resolveAgentWorkspaceAccess(agent, authResult.user.id);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const rows = await listKnowledgeSuggestions(id, { status });
    return NextResponse.json(
      { suggestions: rows, canApprove: Boolean(access.canManage) },
      { status: 200 }
    );
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to list suggestions", details: {} } },
      { status: status === 403 || status === 404 ? status : 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id } = await params;
    await getAgentForUser(id, authResult.user.id, { mutate: true });
    const result = await refreshKnowledgeSuggestions(id, { userId: authResult.user.id });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to refresh suggestions", details: {} } },
      { status: status === 403 || status === 404 ? status : 500 }
    );
  }
}
