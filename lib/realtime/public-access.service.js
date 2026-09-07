import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { getRealtimeConfig } from "./config.js";
import { hashRealtimeBinding, signPublicRealtimeToken } from "./tokens.js";

const ACCESS_TOKEN_BYTES = 32;

export async function createPublicConversationAccess({
  conversationId,
  customerSubject = null,
  origin = null,
  expiresAt,
  tx = prisma,
}) {
  const rawToken = randomBytes(ACCESS_TOKEN_BYTES).toString("base64url");
  const access = await tx.publicConversationAccess.create({
    data: {
      conversationId,
      tokenHash: hashRealtimeBinding(rawToken),
      customerSubjectHash: hashRealtimeBinding(customerSubject),
      originHash: hashRealtimeBinding(origin),
      expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    select: { id: true, conversationId: true, expiresAt: true },
  });
  return { rawToken, ...access };
}

export async function verifyPublicConversationAccess({
  rawToken,
  conversationId,
  agentId = null,
  origin = null,
  customerSubject = null,
}) {
  if (!rawToken || !conversationId) return null;
  const access = await prisma.publicConversationAccess.findFirst({
    where: {
      tokenHash: hashRealtimeBinding(rawToken),
      conversationId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      conversation: {
        select: {
          id: true,
          agentId: true,
          customerSubject: true,
          agent: { select: { publicKey: true, enabled: true, embedEnabled: true } },
        },
      },
    },
  });
  if (!access) return null;
  if (agentId && access.conversation.agentId !== agentId) return null;
  if (access.originHash && access.originHash !== hashRealtimeBinding(origin)) return null;
  if (
    access.customerSubjectHash &&
    access.customerSubjectHash !== hashRealtimeBinding(customerSubject)
  ) {
    return null;
  }
  if (!access.conversation.agent?.enabled || !access.conversation.agent.embedEnabled) return null;

  await prisma.publicConversationAccess.update({
    where: { id: access.id },
    data: { lastUsedAt: new Date() },
  });
  return access;
}

export async function issuePublicRealtimeToken({
  rawAccessToken,
  conversationId,
  agentId = null,
  origin,
  customerSubject = null,
}) {
  const access = await verifyPublicConversationAccess({
    rawToken: rawAccessToken,
    conversationId,
    agentId,
    origin,
    customerSubject,
  });
  if (!access) {
    const error = new Error("Public conversation access denied");
    error.status = 401;
    throw error;
  }

  const config = getRealtimeConfig();
  const token = await signPublicRealtimeToken({
    conversationId: access.conversation.id,
    agentId: access.conversation.agentId,
    publicKeyId: access.conversation.agent.publicKey || access.conversation.agentId,
    realtimeSessionId: access.id,
    customerSubjectHash: access.customerSubjectHash,
    originHash: access.originHash,
    config,
  });
  return { token, expiresInSeconds: config.tokenTtlSeconds };
}
