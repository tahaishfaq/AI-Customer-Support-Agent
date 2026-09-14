import prisma from "@/lib/prisma";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Comma-separated reserved operator emails from a settings/env string. */
export function parseReservedAdminEmails(value) {
  return String(value || "")
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter(Boolean);
}

/**
 * Optional leftover env lock. App seed no longer requires ADMIN_BOOTSTRAP_*.
 * Prefer PlatformSettings + DB role=ADMIN.
 */
export function reservedAdminEmail() {
  return parseReservedAdminEmails(process.env.ADMIN_BOOTSTRAP_EMAIL)[0] || "";
}

/** Sync check — env only (safe for edge / fast paths). */
export function isReservedAdminEmail(email) {
  const reserved = parseReservedAdminEmails(process.env.ADMIN_BOOTSTRAP_EMAIL);
  const normalized = normalizeEmail(email);
  return Boolean(normalized && reserved.includes(normalized));
}

/**
 * Full lock: optional env, PlatformSettings.reservedAdminEmail (comma list),
 * or DB role=ADMIN. Use in Node auth / register paths (F06).
 */
export async function isProtectedAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (isReservedAdminEmail(normalized)) return true;

  try {
    const { getPlatformSettings } = await import(
      "@/lib/services/platform-settings.service"
    );
    const settings = await getPlatformSettings();
    if (
      parseReservedAdminEmails(settings.reservedAdminEmail).includes(normalized)
    ) {
      return true;
    }
  } catch {
    // settings unavailable — fall through to DB
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", email: normalized },
    select: { id: true },
  });
  return Boolean(admin);
}
