import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { activateWorkspaceForUser } from "@/lib/services/workspace.service";

export async function POST(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const result = await activateWorkspaceForUser(id, authResult.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error.status) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/workspaces/[id]/activate", error);
    return NextResponse.json(
      { error: { message: "Unable to activate workspace", details: {} } },
      { status: 500 }
    );
  }
}
