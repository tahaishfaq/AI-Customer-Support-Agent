import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getRealtimeConfig } from "./config.js";
import { signOwnerRealtimeToken } from "./tokens.js";

function expiresAt(config) {
  return new Date(Date.now() + config.tokenTtlSeconds * 1000);
}

export async function issueOwnerRealtimeSession({ userId, deviceLabel = null }) {
  const config = getRealtimeConfig();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, workspaces: { select: { id: true } } },
  });

  if (!user || user.status === "SUSPENDED") {
    const error = new Error("Realtime access denied");
    error.status = 401;
    throw error;
  }

  const tokenId = randomUUID();
  const session = await prisma.realtimeSession.create({
    data: {
      userId: user.id,
      tokenId,
      deviceLabel: String(deviceLabel || "").trim().slice(0, 120) || null,
      expiresAt: expiresAt(config),
    },
  });

  const token = await signOwnerRealtimeToken({
    userId: user.id,
    realtimeSessionId: session.id,
    tokenId,
    role: user.role,
    workspaceIds: user.workspaces.map((workspace) => workspace.id),
    config,
  });

  return {
    token,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    workspaceIds: user.workspaces.map((workspace) => workspace.id),
  };
}

export async function assertRealtimeSessionActive({ sessionId, tokenId, userId }) {
  const session = await prisma.realtimeSession.findFirst({
    where: {
      id: sessionId,
      tokenId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  return Boolean(session);
}

export async function revokeRealtimeSession({ userId, sessionId }) {
  return prisma.realtimeSession.updateMany({
    where: { userId, id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRealtimeSessions(userId) {
  return prisma.$transaction([
    prisma.realtimeSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { realtimeSessionVersion: { increment: 1 } },
      select: { id: true },
    }),
  ]);
}
