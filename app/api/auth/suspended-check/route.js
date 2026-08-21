import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const limited = rateLimit(`suspended-check:${clientIp(request)}`, {
      limit: 20,
      windowMs: 15 * 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(limited);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ suspended: false }, { status: 200 });
    }

    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      return NextResponse.json({ suspended: false }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true, role: true },
    });
    const suspended = Boolean(
      user && user.status === "SUSPENDED" && user.role !== "ADMIN"
    );
    let restoreStatus = null;
    if (suspended) {
      const latest = await prisma.restoreRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      });
      restoreStatus = latest?.status || null;
    }
    return NextResponse.json({ suspended, restoreStatus }, { status: 200 });
  } catch (error) {
    console.error("POST /api/auth/suspended-check", error);
    return NextResponse.json({ suspended: false }, { status: 200 });
  }
}
