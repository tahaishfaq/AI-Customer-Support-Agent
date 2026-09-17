import assert from "node:assert/strict";
import "dotenv/config";
const prismaModule = await import("../lib/prisma.js");
const prisma = prismaModule.default?.default || prismaModule.default;
const { createPublicConversationAccess, verifyPublicConversationAccess } = await import("../lib/realtime/public-access.service.js");
const { createTurnRun } = await import("../lib/services/turn-run.service.js");
const { createPreparedWrite } = await import("../lib/services/durable-write.service.js");

const tag = `aide-g2-${Date.now()}`;
const created = { users: [], workspaces: [], agents: [], conversations: [], accesses: [], turns: [], writes: [] };

async function cleanup() {
  await prisma.publicConversationAccess.deleteMany({ where: { id: { in: created.accesses } } });
  await prisma.turnRun.deleteMany({ where: { id: { in: created.turns } } });
  await prisma.durableWriteOperation.deleteMany({ where: { id: { in: created.writes } } });
  await prisma.conversation.deleteMany({ where: { id: { in: created.conversations } } });
  await prisma.agent.deleteMany({ where: { id: { in: created.agents } } });
  await prisma.workspace.deleteMany({ where: { id: { in: created.workspaces } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
}

try {
  const users = await Promise.all(Array.from({ length: 4 }, (_, index) => prisma.user.create({
    data: { name: `${tag}-user-${index + 1}`, email: `${tag}-${index + 1}@example.test` },
  })));
  created.users.push(...users.map((user) => user.id));
  const workspaces = await Promise.all(users.map((user, index) => prisma.workspace.create({
    data: { userId: user.id, name: `${tag}-workspace-${index + 1}`, slug: `${tag}-workspace-${index + 1}` },
  })));
  created.workspaces.push(...workspaces.map((workspace) => workspace.id));
  const workspaceForAgent = (index) => workspaces[index < 3 ? 0 : index < 5 ? 1 : index < 8 ? 2 : 3];
  const agents = await Promise.all(Array.from({ length: 10 }, (_, index) => {
    const workspace = workspaceForAgent(index);
    return prisma.agent.create({ data: {
      userId: workspace.userId,
      workspaceId: workspace.id,
      name: `${tag}-agent-${index + 1}`,
      systemPrompt: "synthetic",
      welcomeMessage: "synthetic",
      publicKey: `${tag}-public-${index + 1}`,
      enabled: true,
      embedEnabled: true,
    } });
  }));
  created.agents.push(...agents.map((agent) => agent.id));
  const conversations = await Promise.all(agents.map((agent, index) => prisma.conversation.create({
    data: { agentId: agent.id, source: "EMBED", customerSubject: `${tag}-customer-${index % 4}` },
  })));
  created.conversations.push(...conversations.map((conversation) => conversation.id));

  const access = await createPublicConversationAccess({ conversationId: conversations[0].id, customerSubject: `${tag}-customer-0`, origin: "https://tenant-one.example.test" });
  created.accesses.push(access.id);
  assert.ok(await verifyPublicConversationAccess({ rawToken: access.rawToken, conversationId: conversations[0].id, agentId: agents[0].id, origin: "https://tenant-one.example.test", customerSubject: `${tag}-customer-0` }));
  assert.equal(await verifyPublicConversationAccess({ rawToken: access.rawToken, conversationId: conversations[0].id, agentId: agents[1].id, origin: "https://tenant-one.example.test", customerSubject: `${tag}-customer-0` }), null);
  assert.equal(await verifyPublicConversationAccess({ rawToken: access.rawToken, conversationId: conversations[0].id, agentId: agents[0].id, origin: "https://tenant-two.example.test", customerSubject: `${tag}-customer-0` }), null);
  assert.equal(await verifyPublicConversationAccess({ rawToken: access.rawToken, conversationId: conversations[0].id, agentId: agents[0].id, origin: "https://tenant-one.example.test", customerSubject: `${tag}-customer-1` }), null);
  assert.equal(await verifyPublicConversationAccess({ rawToken: access.rawToken, conversationId: conversations[1].id, agentId: agents[1].id, origin: "https://tenant-one.example.test", customerSubject: `${tag}-customer-0` }), null);

  for (let index = 0; index < agents.length; index += 1) {
    const agent = agents[index];
    const conversation = conversations[index];
    const workspace = workspaceForAgent(index);
    assert.equal((await prisma.conversation.findFirst({ where: { id: conversation.id, agentId: agent.id, agent: { workspaceId: workspace.id } } }))?.id, conversation.id);
    const turn = await createTurnRun({ agentId: agent.id, conversationId: conversation.id, workspaceId: workspace.id, clientMessageId: `${tag}-client-${index}`, requestId: `${tag}-request-${index}` });
    const replay = await createTurnRun({ agentId: agent.id, conversationId: conversation.id, workspaceId: workspace.id, clientMessageId: `${tag}-client-${index}`, requestId: `${tag}-request-replay-${index}` });
    created.turns.push(turn.id);
    assert.equal(replay.id, turn.id);
    for (let other = 0; other < agents.length; other += 1) {
      if (other === index) continue;
      assert.equal(await prisma.conversation.findFirst({ where: { id: conversation.id, agentId: agents[other].id } }), null);
    }
  }

  const write1 = await createPreparedWrite({ agentId: agents[0].id, workspaceId: workspaces[0].id, customerSubject: `${tag}-customer-0`, principalScope: "CUSTOMER", logicalOperationId: `${tag}-logical-1`, actionId: `${tag}-action-1` });
  const write2 = await createPreparedWrite({ agentId: agents[3].id, workspaceId: workspaces[1].id, customerSubject: `${tag}-customer-1`, principalScope: "CUSTOMER", logicalOperationId: `${tag}-logical-1`, actionId: `${tag}-action-2` });
  const write3 = await createPreparedWrite({ agentId: agents[6].id, workspaceId: workspaces[2].id, customerSubject: `${tag}-customer-2`, principalScope: "CUSTOMER", logicalOperationId: `${tag}-logical-1`, actionId: `${tag}-action-3` });
  const write4 = await createPreparedWrite({ agentId: agents[8].id, workspaceId: workspaces[3].id, customerSubject: `${tag}-customer-3`, principalScope: "CUSTOMER", logicalOperationId: `${tag}-logical-1`, actionId: `${tag}-action-4` });
  created.writes.push(write1.id, write2.id, write3.id, write4.id);
  assert.equal(new Set([write1.id, write2.id, write3.id, write4.id]).size, 4);
  await assert.rejects(
    () => createPreparedWrite({ agentId: agents[0].id, workspaceId: workspaces[0].id, customerSubject: `${tag}-customer-0`, principalScope: "CUSTOMER", logicalOperationId: `${tag}-logical-1`, actionId: `${tag}-action-1` }),
    (error) => error?.code === "P2002"
  );

  console.log("Gate 2 database tenant matrix passed");
  console.log(JSON.stringify({ agents: 10, workspaces: 4, users: 4, publicBindingChecks: 5, turnReplayChecks: 20, crossAgentConversationChecks: 90, writeIsolationChecks: 5, dataPrefix: tag }, null, 2));
} finally {
  await cleanup();
  await prisma.$disconnect();
}
