import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/services/platform-settings.service";

export async function GET() {
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json(
      {
        signupsEnabled: settings.signupsEnabled,
        maintenanceMode: settings.maintenanceMode,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/public/platform", error);
    return NextResponse.json(
      { signupsEnabled: true, maintenanceMode: false },
      { status: 200 }
    );
  }
}
