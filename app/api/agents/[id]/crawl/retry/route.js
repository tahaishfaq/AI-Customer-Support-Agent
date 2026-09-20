import { after, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { resolveRequestId } from "@/lib/observability/request-id";
import { retrySiteCrawlForAgent } from "@/lib/services/knowledge.service";
import { runCrawlJob } from "@/lib/services/embed.service";
import { enqueueSiteCrawlJob } from "@/lib/jobs/enqueue";
import { isBullMqEnabled } from "@/lib/jobs/queues";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const requestId = resolveRequestId(request);
    const limited = await rateLimit(`crawl-retry:${authResult.user.id}:${id}`, {
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many crawl retries. Try again in a few minutes."
      );
    }

    let homepageUrl = "";
    let urls = [];
    try {
      const body = await request.json();
      homepageUrl = String(body?.homepageUrl || body?.origin || "").trim();
      if (Array.isArray(body?.urls)) {
        urls = body.urls.map((u) => String(u || "").trim()).filter(Boolean);
      } else if (typeof body?.urls === "string" && body.urls.trim()) {
        urls = body.urls
          .split(/[\n,]+/)
          .map((u) => u.trim())
          .filter(Boolean);
      }
      if (!urls.length && homepageUrl.includes("\n")) {
        urls = homepageUrl
          .split(/[\n,]+/)
          .map((u) => u.trim())
          .filter(Boolean);
        homepageUrl = "";
      }
    } catch {
      homepageUrl = "";
      urls = [];
    }

    const result = await retrySiteCrawlForAgent(id, authResult.user.id, {
      requestId,
      homepageUrl: homepageUrl || undefined,
      urls: urls.length ? urls : undefined,
    });

    after(async () => {
      if (isBullMqEnabled()) {
        const queued = await enqueueSiteCrawlJob({
          siteCrawlJobId: result.jobId,
          agentId: id,
          requestId,
          delayMs: 0,
        });
        if (queued.ok) return;
      }
      await runCrawlJob(result.jobId, { requestId });
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409
    ) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            details: error.details || {},
            code: error.code || error.details?.code,
          },
        },
        { status: error.status }
      );
    }
    console.error("POST /api/agents/[id]/crawl/retry", error);
    return NextResponse.json(
      { error: { message: "Unable to retry website crawl", details: {} } },
      { status: 500 }
    );
  }
}
