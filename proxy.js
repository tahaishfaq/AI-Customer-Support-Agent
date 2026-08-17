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

export async function proxy(request) {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && PUBLIC_AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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
  ],
};
