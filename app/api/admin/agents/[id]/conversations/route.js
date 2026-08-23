import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listAdminConversations } from "@/lib/services/admin-inspect.service";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const data = await listAdminConversations(id, {
      limit: searchParams.get("limit") || 20,
      offset: searchParams.get("offset") || 0,
    });
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 404 }
      );
    }
    console.error("GET /api/admin/agents/[id]/conversations", error);
    return NextResponse.json(
      { error: { message: "Unable to list conversations", details: {} } },
      { status: 500 }
    );
  }
}
