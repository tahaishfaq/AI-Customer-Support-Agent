import { hashPassword } from "@/lib/password";
import prisma from "@/lib/prisma";
import { ensureDefaultWorkspace } from "@/lib/services/workspace.service";

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

/** Create email/password user. Session is created by NextAuth signIn on the client. */
export async function registerUser({ name, email, password }) {
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
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
    },
  });

  await ensureDefaultWorkspace(user.id);

  return { user: toPublicUser(user) };
}
