import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getPlatformOverview } from "@/lib/services/admin-overview.service";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const overview = await getPlatformOverview();
    return NextResponse.json({ overview }, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/overview", error);
    return NextResponse.json(
      { error: { message: "Unable to load admin overview", details: {} } },
      { status: 500 }
    );
  }
}
