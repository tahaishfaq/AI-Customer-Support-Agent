/**
 * Stable embed end-customer records (workspace + subject). Never store raw tokens.
 */
import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";

function hashClaim(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * Upsert EndUser and link conversation.endUserId.
 * @param {{
 *   workspaceId: string|null|undefined,
 *   conversationId: string,
 *   subject: string,
 *   email?: string|null,
 *   phone?: string|null,
 * }} opts
 * @returns {Promise<{ id: string }|null>}
 */
export async function upsertEndUserForConversation({
  workspaceId,
  conversationId,
  subject,
  email = null,
  phone = null,
}) {
  const sub = String(subject || "").trim();
  if (!workspaceId || !conversationId || !sub) return null;

  try {
    const endUser = await prisma.endUser.upsert({
      where: {
        workspaceId_subject: { workspaceId, subject: sub },
      },
      create: {
        workspaceId,
        subject: sub,
        emailHash: hashClaim(email),
        phoneHash: hashClaim(phone),
        lastSeenAt: new Date(),
      },
      update: {
        lastSeenAt: new Date(),
        ...(email ? { emailHash: hashClaim(email) } : {}),
        ...(phone ? { phoneHash: hashClaim(phone) } : {}),
      },
      select: { id: true },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { endUserId: endUser.id },
    });

    return endUser;
  } catch {
    // Table may be absent until migrate deploy — fail open for chat.
    return null;
  }
}
