import { hashPassword } from "@/lib/password";
import prisma from "@/lib/prisma";
import { ensureDefaultWorkspace } from "@/lib/services/workspace.service";

import { getPlatformSettings } from "@/lib/services/platform-settings.service";
import { isProtectedAdminEmail } from "@/lib/admin-email";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "USER",
    createdAt: user.createdAt,
  };
}

/** Create email/password user. Session is created by NextAuth signIn on the client. */
export async function registerUser({ name, email, password }) {
  const settings = await getPlatformSettings();
  if (!settings.signupsEnabled) {
    throw httpError(403, "Signups closed");
  }
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing || (await isProtectedAdminEmail(email))) {
    const err = new Error("Email already exists");
    err.status = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "USER",
      status: "ACTIVE",
    },
  });

  await ensureDefaultWorkspace(user.id);

  return { user: toPublicUser(user) };
}
