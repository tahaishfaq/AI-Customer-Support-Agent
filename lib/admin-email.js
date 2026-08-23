import prisma from "@/lib/prisma";

/** Reserved operator email from env. Never a Google/customer signup. */
export function reservedAdminEmail() {
  return String(process.env.ADMIN_BOOTSTRAP_EMAIL || "")
    .trim()
    .toLowerCase();
}

/** Sync check — env only (safe for edge / fast paths). */
export function isReservedAdminEmail(email) {
  const reserved = reservedAdminEmail();
  if (!reserved || !email) return false;
  return String(email).trim().toLowerCase() === reserved;
}

/**
 * Full lock: env OR PlatformSettings.reservedAdminEmail OR DB role=ADMIN.
 * Use in Node auth / register paths (F06).
 */
export async function isProtectedAdminEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  if (isReservedAdminEmail(normalized)) return true;

  try {
    const { getPlatformSettings } = await import(
      "@/lib/services/platform-settings.service"
    );
    const settings = await getPlatformSettings();
    if (
      settings.reservedAdminEmail &&
      settings.reservedAdminEmail === normalized
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
