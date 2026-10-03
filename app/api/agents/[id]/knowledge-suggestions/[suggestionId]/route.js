import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { reviewKnowledgeSuggestion } from "@/lib/services/ai/knowledge-suggestion.service";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { suggestionId } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Invalid JSON", details: {} } },
        { status: 400 }
      );
    }
    const action = body?.action === "dismiss" ? "dismiss" : "accept";
    const row = await reviewKnowledgeSuggestion({
      suggestionId,
      userId: authResult.user.id,
      action,
      title: body?.title,
      draftAnswer: body?.draftAnswer,
    });
    return NextResponse.json({ suggestion: row }, { status: 200 });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to review suggestion", details: {} } },
      { status: status === 400 || status === 403 || status === 404 ? status : 500 }
    );
  }
}
