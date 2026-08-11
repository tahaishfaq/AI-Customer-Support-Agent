import { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "hapy_token";

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SEVEN_DAYS,
  };
}

export function setAuthCookie(response, token) {
  response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  return response;
}

export function clearAuthCookie(response) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...getAuthCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export function getTokenFromCookies(request) {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value || null;
}
