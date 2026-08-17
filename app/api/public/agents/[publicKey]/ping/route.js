import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  enqueueOneTimeCrawl,
  getPublicAgentByKey,
  runCrawlJob,
} from "@/lib/services/embed.service";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request, { params }) {
  try {
    const { publicKey } = await params;
    const ip = clientIp(request);
    const limited = rateLimit(`pub-ping:${publicKey}:${ip}`, {
      limit: 8,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { ok: true, queued: false, reason: "rate-limit" },
        { status: 200 }
      );
    }

    const agent = await getPublicAgentByKey(publicKey);
    if (!agent) {
      return NextResponse.json(
        { error: { message: "Agent not found", details: {} } },
        { status: 404 }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const result = await enqueueOneTimeCrawl(agent.id, body.origin);
    if (result.queued && result.jobId) {
      after(() => runCrawlJob(result.jobId));
    }

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("POST /api/public/agents/[publicKey]/ping", error);
    return NextResponse.json({ ok: false, queued: false }, { status: 200 });
  }
}
