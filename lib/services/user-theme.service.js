/**
 * Account-synced app shell theme (light|dark).
 * Cookie/localStorage remain SSR/cache only — User.uiTheme is source of truth when logged in.
 */

import prisma from "@/lib/prisma";
import { invalidatePublicUserCache } from "@/lib/services/user-profile-cache";

export const UI_THEMES = Object.freeze(["light", "dark"]);

export function normalizeUiTheme(value) {
  return value === "dark" ? "dark" : "light";
}

export async function getUserUiTheme(userId) {
  const id = String(userId || "").trim();
  if (!id) return "light";
  const row = await prisma.user.findUnique({
    where: { id },
    select: { uiTheme: true },
  });
  return normalizeUiTheme(row?.uiTheme);
}

export async function setUserUiTheme(userId, theme) {
  const id = String(userId || "").trim();
  if (!id) {
    const err = new Error("Unauthorized");
    err.code = "UNAUTHORIZED";
    err.status = 401;
    throw err;
  }
  const raw = String(theme || "").trim();
  if (!UI_THEMES.includes(raw)) {
    const err = new Error("Invalid theme");
    err.code = "INVALID_THEME";
    err.status = 400;
    throw err;
  }
  const next = normalizeUiTheme(raw);
  const row = await prisma.user.update({
    where: { id },
    data: { uiTheme: next },
    select: { uiTheme: true },
  });
  await invalidatePublicUserCache(id).catch(() => {});
  return normalizeUiTheme(row.uiTheme);
}
