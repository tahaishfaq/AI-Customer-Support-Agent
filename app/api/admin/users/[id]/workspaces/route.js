import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listWorkspacesForUser } from "@/lib/services/admin-users.service";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const workspaces = await listWorkspacesForUser(id);
    return NextResponse.json({ workspaces }, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/users/[id]/workspaces", error);
    return NextResponse.json(
      { error: { message: "Unable to load workspaces", details: {} } },
      { status: 500 }
    );
  }
}
