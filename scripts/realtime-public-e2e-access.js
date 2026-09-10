import "dotenv/config";
import { randomUUID } from "node:crypto";
import prisma from "../lib/prisma.js";
import { createPublicConversationAccess } from "../lib/realtime/public-access.service.js";

async function main() {
  let accessId;
  try {
    if (process.argv[2] === "cleanup") {
      if (process.argv[3]) {
        await prisma.publicConversationAccess
          .delete({ where: { id: process.argv[3] } })
          .catch(() => {});
      }
      return;
    }
    const conversation = await prisma.conversation.findFirst({
      where: { agent: { publicKey: { not: null }, enabled: true, embedEnabled: true } },
      select: { id: true, agent: { select: { publicKey: true } } },
    });
    if (!conversation) throw new Error("An enabled public conversation is required");
    const access = await createPublicConversationAccess({
      conversationId: conversation.id,
      origin: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    accessId = access.id;
    console.log(
      JSON.stringify({
        accessId,
        conversationId: conversation.id,
        publicKey: conversation.agent.publicKey,
        rawToken: access.rawToken,
        marker: `phase3-${randomUUID()}`,
      })
    );
  } finally {
    await prisma.$disconnect?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
