import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const timestamp = new Date().toISOString();
  let database = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("GET /api/health database", error);
    database = "error";
  }

  const ok = database === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      service: "hapy-api",
      database,
      timestamp,
    },
    { status: ok ? 200 : 503 }
  );
}
