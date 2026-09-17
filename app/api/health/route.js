import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isEmailConfigured } from "@/lib/email/client";
import { getRedisHealth } from "@/lib/redis/client";

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
  const redisHealth = await getRedisHealth();
  const redis = redisHealth.status;
  const ok = database === "ok";
  // Redis disabled is fine; misconfigured/error while enabled → degraded.
  const redisHardFail =
    redisHealth.status === "misconfigured" || redisHealth.status === "error";
  const status = !ok ? "degraded" : redisHardFail ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      service: "aide-api",
      database,
      email,
      redis,
      redisPrefix: redisHealth.prefix,
      timestamp,
    },
    { status: ok ? 200 : 503 }
  );
}
