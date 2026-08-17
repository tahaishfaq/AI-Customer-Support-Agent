export const WORKSPACE_COOKIE = "hapy_workspace";

export function workspaceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  };
}
