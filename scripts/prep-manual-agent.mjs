/**
 * Prep AI Assist for manual A–G: knowledge + actions/web flags + sample tools.
 * Does NOT print secrets or public keys.
 *
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/prep-manual-agent.mjs
 */
import "dotenv/config";
import fs from "node:fs";

const prisma = (await import("../lib/prisma.js")).default;

const AGENT_ID = process.env.MANUAL_AGENT_ID || "cmt5he44d0000loi1a75lv80f";

const FAQ = `# Brandly / Demo Store FAQ

## Product X
- Product X (Brandly Starter Kit) is **in stock** at our store.
- Store price: **PKR 4,999**.
- SKU: BLX-001.

## Returns
- Return policy: unused items can be returned within **14 days** of delivery for a full refund.
- Open a return from your account → Orders → Request return.

## Support
- Email: support@brandly.example
- Hours: Mon–Fri 9:00–18:00 PKT.

## Privacy
- We never share another customer's orders or account data.
`;

const agent = await prisma.agent.findUnique({
  where: { id: AGENT_ID },
  select: {
    id: true,
    name: true,
    workspaceId: true,
    actionsEnabled: true,
    webSearchEnabled: true,
    publicKey: true,
  },
});

if (!agent) {
  console.error("AGENT_NOT_FOUND", AGENT_ID);
  process.exit(1);
}

await prisma.agent.update({
  where: { id: agent.id },
  data: {
    actionsEnabled: true,
    webSearchEnabled: true,
  },
});

const existingFaq = await prisma.knowledgeDocument.findFirst({
  where: { agentId: agent.id, name: "Demo Store FAQ" },
});
if (existingFaq) {
  await prisma.knowledgeDocument.update({
    where: { id: existingFaq.id },
    data: { content: FAQ, type: "TEXT" },
  });
} else {
  await prisma.knowledgeDocument.create({
    data: {
      agentId: agent.id,
      name: "Demo Store FAQ",
      type: "TEXT",
      content: FAQ,
    },
  });
}

async function upsertAction(data) {
  const prev = await prisma.agentAction.findFirst({
    where: { agentId: agent.id, name: data.name },
  });
  if (prev) {
    return prisma.agentAction.update({
      where: { id: prev.id },
      data: { ...data, enabled: true },
    });
  }
  return prisma.agentAction.create({
    data: { agentId: agent.id, ...data, enabled: true },
  });
}

await upsertAction({
  name: "lookup_product_x",
  description: "Look up Product X stock and store price from the demo catalog API.",
  method: "GET",
  urlTemplate: "https://httpbin.org/get?sku=BLX-001&name=Product%20X&inStock=true&pricePkr=4999",
  riskLevel: "READ",
  requiresConfirmation: false,
  requiresIdentity: false,
  identityMode: "NONE",
  accessClass: "PUBLIC_READ",
  idempotent: true,
  inputSchemaJson: { type: "object", properties: {}, additionalProperties: false },
});

await upsertAction({
  name: "create_support_ticket",
  description:
    "Create a support ticket for the customer. Requires confirmation before sending. Args: subject (string), body (string).",
  method: "POST",
  urlTemplate: "https://httpbin.org/post",
  riskLevel: "WRITE",
  requiresConfirmation: true,
  requiresIdentity: false,
  identityMode: "NONE",
  accessClass: "ACCOUNT_WRITE",
  idempotent: false,
  inputSchemaJson: {
    type: "object",
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
    },
    required: ["subject", "body"],
    additionalProperties: false,
  },
});

const actions = await prisma.agentAction.findMany({
  where: { agentId: agent.id, enabled: true },
  select: { name: true, riskLevel: true, requiresConfirmation: true },
});
const docs = await prisma.knowledgeDocument.count({
  where: { agentId: agent.id },
});

const out = {
  agentId: agent.id,
  name: agent.name,
  actionsEnabled: true,
  webSearchEnabled: true,
  knowledgeDocs: docs,
  actions,
  note: "Hosted web search remains rollout-disabled until the staging probe passes",
};
fs.mkdirSync(".tmp", { recursive: true });
fs.writeFileSync(".tmp/manual-agent-prep.json", JSON.stringify(out, null, 2));
console.log("OK", JSON.stringify(out));
await prisma.$disconnect();
