import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isEmailConfigured } from "@/lib/email/client";

export async function GET() {
  const timestamp = new Date().toISOString();
  let database = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("GET /api/health database", error);
    database = "error";
  }

  const email = isEmailConfigured() ? "ok" : "unconfigured";
  const ok = database === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      service: "aide-api",
      database,
      email,
      timestamp,
    },
    { status: ok ? 200 : 503 }
  );
}
