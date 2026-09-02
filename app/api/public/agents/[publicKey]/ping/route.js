import { after } from "next/server";
import { NextResponse } from "next/server";
import { mergeCustomization } from "@/lib/customization/defaults";
import { normalizeWidgetPosition } from "@/lib/customization/position";
import {
  claimEmbedOrigin,
  getPublicAgentByKey,
  runCrawlJob,
} from "@/lib/services/embed.service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pubPingLimitOpts } from "@/lib/rate-limit-config";
import { originFromRequest } from "@/lib/utils/request-origin";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";

export const maxDuration = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-request-id",
};

function denyMessage(reason) {
  if (reason === "agent_locked") {
    return "This agent is locked to another website";
  }
  if (reason === "origin_taken") {
    return "This website is already linked to another agent";
  }
  if (reason === "missing") {
    return "Agent not found";
  }
  return "Widget unavailable for this origin";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);

  try {
    const { publicKey } = await params;
    const ip = clientIp(request);
    const limited = rateLimit(
      `pub-ping:${publicKey}:${ip}`,
      pubPingLimitOpts()
    );
    if (!limited.ok) {
      // Soft-limit: do not break embed UX; still attach request id.
      return jsonOk(
        request,
        { ok: true, queued: false, reason: "rate-limit" },
        200,
        corsHeaders
      );
    }

    // Bind only from browser Origin/Referer — never from client body.origin.
    const trustedOrigin = originFromRequest(request);
    const agent = await getPublicAgentByKey(publicKey, {
      origin: trustedOrigin,
    });
    if (!agent) {
      return jsonError(request, 404, "Agent not found", {}, corsHeaders);
    }

    const result = await claimEmbedOrigin(agent.id, trustedOrigin, {
      requestId,
    });
    if (!result.allowed) {
      // Keep HTTP 403 — PublicWebchat / embed treat 403 as unavailable.
      return jsonError(
        request,
        403,
        denyMessage(result.reason),
        {
          ok: false,
          reason: result.reason || "denied",
          origin: result.origin || undefined,
        },
        corsHeaders
      );
    }
    if (result.queued && result.jobId) {
      // Defer crawl slightly so chat/ping DB work settles (same Neon pool).
      const deferMs = Math.min(
        Math.max(Number(process.env.CRAWL_DEFER_MS) || 750, 0),
        10_000
      );
      after(async () => {
        if (deferMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, deferMs));
        }
        await runCrawlJob(result.jobId, { requestId });
      });
    }

    const widgetPosition = normalizeWidgetPosition(
      mergeCustomization(agent.customization).deploy?.widgetPosition
    );

    return jsonOk(
      request,
      { ok: true, ...result, widgetPosition },
      200,
      corsHeaders
    );
  } catch {
    safeLogError("POST /api/public/agents/[publicKey]/ping", {
      requestId,
      route: "public-ping",
      status: 500,
    });
    return jsonError(
      request,
      500,
      "Unable to claim embed origin",
      { ok: false, queued: false },
      corsHeaders
    );
  }
}
