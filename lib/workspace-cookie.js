export const WORKSPACE_COOKIE = "aide_workspace";
export const WORKSPACE_SLUG_COOKIE = "aide_ws_slug";

export function workspaceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  };
}
