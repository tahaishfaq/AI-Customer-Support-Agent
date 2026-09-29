import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { unshareDocumentForConsumer } from "@/lib/services/knowledge.service";

/** Consumer unlinks a shared document from this agent (does not delete the source). */
export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id: agentId } = await params;
    const documentId = String(
      request.nextUrl.searchParams.get("documentId") || ""
    ).trim();
    if (!documentId) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: { documentId: "Required" },
          },
        },
        { status: 400 }
      );
    }

    await unshareDocumentForConsumer(
      documentId,
      agentId,
      authResult.user.id
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404
    ) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("DELETE /api/agents/[id]/knowledge/shares", error);
    return NextResponse.json(
      { error: { message: "Unable to remove shared knowledge", details: {} } },
      { status: 500 }
    );
  }
}
