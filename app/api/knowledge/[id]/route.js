import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { deleteKnowledgeForUser } from "@/lib/services/knowledge.service";

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    await deleteKnowledgeForUser(id, authResult.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (
      error.status === 403 ||
      error.status === 404 ||
      error.status === 500 ||
      error.status === 502
    ) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            details: error.details || {},
          },
        },
        { status: error.status }
      );
    }
    console.error("DELETE /api/knowledge/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to delete knowledge", details: {} } },
      { status: 500 }
    );
  }
}
