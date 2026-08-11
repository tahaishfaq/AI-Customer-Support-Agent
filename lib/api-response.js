import { NextResponse } from "next/server";

export function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function created(data) {
  return NextResponse.json(data, { status: 201 });
}

export function fail(message, status = 400, details = {}) {
  return NextResponse.json(
    {
      error: {
        message,
        details,
      },
    },
    { status }
  );
}
