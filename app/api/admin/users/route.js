import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listAdminUsers } from "@/lib/services/admin-users.service";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const result = await listAdminUsers({
      q: searchParams.get("q") || "",
      status: searchParams.get("status") || "",
      role: searchParams.get("role") || "",
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 20,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/users", error);
    return NextResponse.json(
      { error: { message: "Unable to list users", details: {} } },
      { status: 500 }
    );
  }
}
