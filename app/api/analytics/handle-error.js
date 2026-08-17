import { NextResponse } from "next/server";

export function handleAnalyticsError(route, error) {
  if (error.status === 400 || error.status === 403 || error.status === 404) {
    return NextResponse.json(
      { error: { message: error.message, details: {} } },
      { status: error.status }
    );
  }

  console.error(route, error);
  return NextResponse.json(
    { error: { message: "Unable to load analytics", details: {} } },
    { status: 500 }
  );
}
