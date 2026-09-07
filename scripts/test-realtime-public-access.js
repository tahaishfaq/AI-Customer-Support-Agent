import "dotenv/config";
import assert from "node:assert/strict";

async function main() {
const [{ default: prisma }, accessService] = await Promise.all([
  import("../lib/prisma.js"),
  import("../lib/realtime/public-access.service.js"),
]);

let accessId = null;
let expiredAccessId = null;
try {
  const conversation = await prisma.conversation.findFirst({
    where: {
      agent: { publicKey: { not: null }, enabled: true, embedEnabled: true },
    },
    select: { id: true, agentId: true },
  });
  assert(conversation, "An enabled public conversation is required");

  const created = await accessService.createPublicConversationAccess({
    conversationId: conversation.id,
    customerSubject: "phase1-subject",
    origin: "https://phase1.example",
    expiresAt: new Date(Date.now() + 60_000),
  });
  accessId = created.id;

  const verified = await accessService.verifyPublicConversationAccess({
    rawToken: created.rawToken,
    conversationId: conversation.id,
    agentId: conversation.agentId,
    origin: "https://phase1.example",
    customerSubject: "phase1-subject",
  });
  assert.equal(verified.id, created.id);

  const wrongOrigin = await accessService.verifyPublicConversationAccess({
    rawToken: created.rawToken,
    conversationId: conversation.id,
    agentId: conversation.agentId,
    origin: "https://attacker.example",
    customerSubject: "phase1-subject",
  });
  assert.equal(wrongOrigin, null);

  const expired = await accessService.createPublicConversationAccess({
    conversationId: conversation.id,
    expiresAt: new Date(Date.now() - 1000),
  });
  expiredAccessId = expired.id;
  await assert.rejects(
    accessService.issuePublicRealtimeToken({
      rawAccessToken: expired.rawToken,
      conversationId: conversation.id,
      agentId: conversation.agentId,
    }),
    (error) => error.status === 401
  );

  console.log("Public realtime capability test passed: issue, verify, subject/origin binding.");
} finally {
  if (accessId) {
    await prisma.publicConversationAccess.delete({ where: { id: accessId } }).catch(() => {});
  }
  if (expiredAccessId) {
    await prisma.publicConversationAccess.delete({ where: { id: expiredAccessId } }).catch(() => {});
  }
  await prisma.$disconnect?.().catch(() => {});
}

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
