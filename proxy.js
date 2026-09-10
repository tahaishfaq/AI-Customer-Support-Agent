import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { WORKSPACE_SLUG_COOKIE } from "@/lib/workspace-cookie";
import {
  parseWorkspacePath,
  usableWorkspaceSlug,
  withWorkspaceSlug,
} from "@/lib/workspace-path";

const { auth } = NextAuth(authConfig);

const PUBLIC_AUTH_PAGES = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agents",
  "/conversations",
  "/analytics",
  "/inbox",
  "/settings",
];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isBillingPath(pathname) {
  return pathname === "/billing" || pathname.startsWith("/billing/");
}

function clonePath(request, pathname) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return url;
}

function redirectToLogin(request, nextPath) {
  const loginUrl = clonePath(request, "/login");
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request) {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);
  const role = session?.user?.role || "USER";
  const { pathname } = request.nextUrl;
  const ws = parseWorkspacePath(pathname);

  // Admin console: ADMIN only. Everyone else (including /admin/login) → 404.
  if (isAdminPath(pathname) || (ws && isAdminPath(ws.inner))) {
    if (isLoggedIn && role === "ADMIN") {
      if (ws) {
        return NextResponse.redirect(clonePath(request, ws.inner));
      }
      return NextResponse.next();
    }
    return NextResponse.rewrite(clonePath(request, "/404"), {
      status: 404,
    });
  }

  // Billing stays unprefixed — /ws/{slug}/billing → /billing
  if (ws && isBillingPath(ws.inner)) {
    return NextResponse.redirect(clonePath(request, ws.inner));
  }

  const gatePath = ws ? ws.inner : pathname;
  const needsAuth =
    isProtectedPath(gatePath) || isBillingPath(pathname) || Boolean(ws);

  if (needsAuth && !isLoggedIn) {
    return redirectToLogin(request, pathname);
  }

  if (isLoggedIn && PUBLIC_AUTH_PAGES.has(pathname)) {
    if (
      pathname === "/login" &&
      (request.nextUrl.searchParams.get("suspended") ||
        request.nextUrl.searchParams.get("session") === "expired")
    ) {
      return NextResponse.next();
    }
    // Token links must run while signed in — do not bounce them to /auth/continue
    // (clonePath keeps ?token=, so continue would drop verification silently).
    if (pathname === "/verify-email" || pathname === "/reset-password") {
      return NextResponse.next();
    }
    const dest = role === "ADMIN" ? "/admin" : "/auth/continue";
    return NextResponse.redirect(clonePath(request, dest));
  }

  if (isLoggedIn && isProtectedPath(pathname) && !ws) {
    const slug = usableWorkspaceSlug(
      request.cookies.get(WORKSPACE_SLUG_COOKIE)?.value
    );
    if (!slug) {
      const url = clonePath(request, "/auth/continue");
      const next = `${pathname}${request.nextUrl.search || ""}`;
      url.searchParams.set("next", next);
      return NextResponse.redirect(url);
    }
    const dest = withWorkspaceSlug(pathname, slug);
    const url = clonePath(request, dest);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && ws) {
    if (!isProtectedPath(ws.inner)) {
      const url = clonePath(request, withWorkspaceSlug("/dashboard", ws.slug));
      return NextResponse.redirect(url);
    }
    const rewriteUrl = clonePath(request, ws.inner);
    rewriteUrl.search = request.nextUrl.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/dashboard",
    "/dashboard/:path*",
    "/agents",
    "/agents/:path*",
    "/conversations",
    "/conversations/:path*",
    "/analytics",
    "/analytics/:path*",
    "/inbox",
    "/inbox/:path*",
    "/billing",
    "/billing/:path*",
    "/settings",
    "/settings/:path*",
    "/admin",
    "/admin/:path*",
    "/ws",
    "/ws/:path*",
  ],
};
