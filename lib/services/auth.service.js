import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/prisma";
import {
  comparePassword,
  hashPassword,
  signToken,
  toPublicUser,
} from "@/lib/auth";

function authResult(user) {
  return {
    user: toPublicUser(user),
    token: signToken(user),
  };
}

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

  return authResult(user);
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.passwordHash) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  return authResult(user);
}

export async function loginWithGoogle(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const err = new Error("Google Sign-In is not configured");
    err.status = 500;
    throw err;
  }

  const client = new OAuth2Client(clientId);
  let ticket;

  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
  } catch {
    const err = new Error("Invalid Google token");
    err.status = 401;
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) {
    const err = new Error("Invalid Google token");
    err.status = 401;
    throw err;
  }

  if (payload.email_verified === false) {
    const err = new Error("Google email is not verified");
    err.status = 401;
    throw err;
  }

  const email = payload.email.toLowerCase();
  const googleId = payload.sub;
  const name = payload.name || email.split("@")[0];

  let user = await prisma.user.findUnique({ where: { googleId } });

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name,
          email,
          googleId,
          passwordHash: null,
        },
      });
    }
  }

  return authResult(user);
}
