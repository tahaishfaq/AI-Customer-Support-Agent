import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  getUserUiTheme,
  setUserUiTheme,
} from "@/lib/services/user-theme.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const theme = await getUserUiTheme(authResult.user.id);
    return NextResponse.json({ theme }, { status: 200 });
  } catch (error) {
    console.error("GET /api/user/theme", error);
    return NextResponse.json(
      { error: { message: "Unable to load theme", details: {} } },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Invalid JSON", details: {} } },
        { status: 400 }
      );
    }

    const theme = await setUserUiTheme(authResult.user.id, body?.theme);
    return NextResponse.json({ theme }, { status: 200 });
  } catch (error) {
    if (error?.status === 400 || error?.code === "INVALID_THEME") {
      return NextResponse.json(
        { error: { message: "Invalid theme", details: {} } },
        { status: 400 }
      );
    }
    console.error("PATCH /api/user/theme", error);
    return NextResponse.json(
      { error: { message: "Unable to save theme", details: {} } },
      { status: 500 }
    );
  }
}
