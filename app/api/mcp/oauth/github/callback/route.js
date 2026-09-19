import { NextResponse } from "next/server";
import { completeGithubMcpOauth } from "@/lib/services/mcp-github-oauth.service";
import { getGithubMcpOauthConfig } from "@/lib/mcp/github-oauth";

/**
 * Canonical app origin from env — never 0.0.0.0 (browser host ≠ OAuth redirect_uri).
 */
function appOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000";
  let origin = String(raw).replace(/\/$/, "");
  try {
    const u = new URL(origin);
    if (u.hostname === "0.0.0.0" || u.hostname === "::") {
      u.hostname = "localhost";
      origin = u.origin;
    }
  } catch {
    origin = "http://localhost:3000";
  }
  return origin;
}

function redirectTo(path) {
  return NextResponse.redirect(new URL(path, appOrigin()));
}

/**
 * GitHub OAuth App callback (pre-registered redirect — no DCR).
 * redirect_uri for token exchange MUST be the same URI used in authorize
 * (from env), not request.host (which may be 0.0.0.0).
 */
export async function GET(request) {
  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cfg = getGithubMcpOauthConfig();
  const redirectUri = cfg.redirectUri;

  if (err) {
    const desc = url.searchParams.get("error_description") || err;
    return redirectTo(
      `/agents?mcp=github_oauth_denied&reason=${encodeURIComponent(String(desc).slice(0, 200))}`
    );
  }

  try {
    const { redirectPath } = await completeGithubMcpOauth({
      code,
      state,
      redirectUri,
    });
    console.info("mcp.github_oauth_callback ok →", redirectPath);
    return redirectTo(redirectPath);
  } catch (error) {
    console.error(
      "GET /api/mcp/oauth/github/callback",
      error?.message || error,
      error?.code || error?.details?.code || ""
    );
    const reason = encodeURIComponent(
      String(error?.message || "oauth_failed").slice(0, 200)
    );
    return redirectTo(`/agents?mcp=github_oauth_error&reason=${reason}`);
  }
}
