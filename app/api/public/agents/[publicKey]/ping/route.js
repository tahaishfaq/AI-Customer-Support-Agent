import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  claimEmbedOrigin,
  getPublicAgentByKey,
  runCrawlJob,
} from "@/lib/services/embed.service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { originFromRequest } from "@/lib/utils/request-origin";

export const maxDuration = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

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
        { status: 200, headers: corsHeaders }
      );
    }

    // Bind only from browser Origin/Referer — never from client body.origin.
    const trustedOrigin = originFromRequest(request);
    const agent = await getPublicAgentByKey(publicKey, {
      origin: trustedOrigin,
    });
    if (!agent) {
      return NextResponse.json(
        { error: { message: "Agent not found", details: {} } },
        { status: 404, headers: corsHeaders }
      );
    }

    const result = await claimEmbedOrigin(agent.id, trustedOrigin);
    if (!result.allowed) {
      return NextResponse.json(
        { ok: false, ...result },
        { status: 403, headers: corsHeaders }
      );
    }
    if (result.queued && result.jobId) {
      after(() => runCrawlJob(result.jobId));
    }

    return NextResponse.json(
      { ok: true, ...result },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("POST /api/public/agents/[publicKey]/ping", error);
    return NextResponse.json(
      { ok: false, queued: false },
      { status: 200, headers: corsHeaders }
    );
  }
}
