import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_AUTH_PAGES = new Set(["/", "/login", "/register"]);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agents",
  "/chat",
  "/conversations",
  "/analytics",
];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminLogin(pathname) {
  return pathname === "/admin/login";
}

export async function proxy(request) {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);
  const role = session?.user?.role || "USER";
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) {
    if (isLoggedIn && role === "ADMIN") {
      if (isAdminLogin(pathname)) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.next();
    }
    return NextResponse.rewrite(new URL("/404", request.url), {
      status: 404,
    });
  }

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && PUBLIC_AUTH_PAGES.has(pathname)) {
    if (
      pathname === "/login" &&
      request.nextUrl.searchParams.get("suspended")
    ) {
      return NextResponse.next();
    }
    const dest = role === "ADMIN" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/dashboard",
    "/dashboard/:path*",
    "/agents",
    "/agents/:path*",
    "/chat",
    "/chat/:path*",
    "/conversations",
    "/conversations/:path*",
    "/analytics",
    "/analytics/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
