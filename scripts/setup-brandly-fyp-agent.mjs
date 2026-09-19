/**
 * One-shot Brandly FYP agent setup (raw pg — no Prisma TS client).
 *
 * Usage:
 *   node --env-file=.env scripts/setup-brandly-fyp-agent.mjs [publicKey]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";

const PUBLIC_KEY = process.argv[2] || "zhsi1XYQbmkob9GjxLPtPOx0";

const KB_PATHS = [
  "/Users/samiafzal/Desktop/FYP/03_Source_Code/FYP/brandin/aide-brandly-knowledge.md",
];

const ACTIONS = [
  {
    name: "get_brandly_campaign_status",
    description:
      "Look up Brandly demo campaign status by id (CAMP-100, CAMP-200, CAMP-999). Use when the user asks about a campaign status, budget, niche, or matched creators.",
    method: "GET",
    urlTemplate: "http://localhost:3000/api/demo/campaigns/{{campaignId}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { campaignId: "string" },
  },
  {
    name: "list_brandly_plans",
    description:
      "List Brandly demo plan/catalog items and prices. Use when the user asks what plans Brandly offers or pricing for starter/pro addons.",
    method: "GET",
    urlTemplate: "http://localhost:3000/api/demo/items",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: {},
  },
  {
    name: "search_brandly_help",
    description:
      "Search Brandly demo help articles by keyword (escrow, payout, matching, dispute, profile). Use for how-to / FAQ style questions when a live lookup is needed.",
    method: "GET",
    urlTemplate: "http://localhost:3000/api/demo/help?q={{query}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { query: "string" },
  },
];

function cuid() {
  return `c${crypto.randomBytes(12).toString("hex")}`;
}

function extractFrozenHost(urlTemplate) {
  try {
    return new URL(String(urlTemplate).replace(/\{\{[^}]+\}\}/g, "x")).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function loadKnowledge() {
  for (const p of KB_PATHS) {
    if (fs.existsSync(p)) return { path: p, content: fs.readFileSync(p, "utf8") };
  }
  throw new Error("Brandly knowledge markdown not found");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL missing");

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 2 });
  const client = await pool.connect();
  try {
    const agentRes = await client.query(
      `SELECT id, name, "webSearchEnabled", "actionsEnabled" FROM "Agent" WHERE "publicKey" = $1 LIMIT 1`,
      [PUBLIC_KEY]
    );
    if (!agentRes.rows.length) throw new Error("No agent found for the provided public key");
    const agent = agentRes.rows[0];

    await client.query(
      `UPDATE "Agent" SET "webSearchEnabled" = true, "embedEnabled" = true, "actionsEnabled" = true, "updatedAt" = NOW() WHERE id = $1`,
      [agent.id]
    );

    const kb = loadKnowledge();
    const kbExisting = await client.query(
      `SELECT id FROM "KnowledgeDocument" WHERE "agentId" = $1 AND name = $2 LIMIT 1`,
      [agent.id, "Brandly Product Knowledge"]
    );
    let knowledgeStatus;
    if (kbExisting.rows.length) {
      await client.query(
        `UPDATE "KnowledgeDocument" SET content = $1, type = 'TEXT', "updatedAt" = NOW() WHERE id = $2`,
        [kb.content, kbExisting.rows[0].id]
      );
      knowledgeStatus = "updated";
    } else {
      await client.query(
        `INSERT INTO "KnowledgeDocument" (id, "agentId", name, type, content, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'TEXT', $4, NOW(), NOW())`,
        [cuid(), agent.id, "Brandly Product Knowledge", kb.content]
      );
      knowledgeStatus = "created";
    }

    const actionSummary = [];
    for (const a of ACTIONS) {
      const existing = await client.query(
        `SELECT id FROM "AgentAction" WHERE "agentId" = $1 AND name = $2 LIMIT 1`,
        [agent.id, a.name]
      );
      const frozenHost = extractFrozenHost(a.urlTemplate);
      if (existing.rows.length) {
        await client.query(
          `UPDATE "AgentAction" SET
            description = $1, method = $2::"ActionHttpMethod", "urlTemplate" = $3, "frozenHost" = $4,
            "headersJson" = $5::jsonb, "inputSchemaJson" = $6::jsonb, enabled = true,
            "riskLevel" = 'READ'::"ActionRiskLevel", "requiresConfirmation" = false,
            "requiresIdentity" = false, "identityMode" = 'NONE'::"ActionIdentityMode",
            "accessClass" = 'PUBLIC_READ'::"ActionAccessClass", idempotent = true,
            "timeoutMs" = 8000, "updatedAt" = NOW()
           WHERE id = $7`,
          [
            a.description,
            a.method,
            a.urlTemplate,
            frozenHost,
            JSON.stringify(a.headersJson),
            JSON.stringify(a.inputSchemaJson),
            existing.rows[0].id,
          ]
        );
        actionSummary.push({ name: a.name, status: "updated" });
      } else {
        await client.query(
          `INSERT INTO "AgentAction" (
            id, "agentId", name, description, method, "urlTemplate", "frozenHost",
            "headersJson", "inputSchemaJson", enabled, "timeoutMs", "riskLevel",
            "requiresConfirmation", "requiresIdentity", "identityMode", "accessClass",
            idempotent, version, "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5::"ActionHttpMethod", $6, $7,
            $8::jsonb, $9::jsonb, true, 8000, 'READ'::"ActionRiskLevel",
            false, false, 'NONE'::"ActionIdentityMode", 'PUBLIC_READ'::"ActionAccessClass",
            true, 1, NOW(), NOW()
          )`,
          [
            cuid(),
            agent.id,
            a.name,
            a.description,
            a.method,
            a.urlTemplate,
            frozenHost,
            JSON.stringify(a.headersJson),
            JSON.stringify(a.inputSchemaJson),
          ]
        );
        actionSummary.push({ name: a.name, status: "created" });
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          agentId: agent.id,
          agentName: agent.name,
          webSearchEnabled: true,
          actionsEnabled: true,
          knowledge: knowledgeStatus,
          actions: actionSummary,
        },
        null,
        2
      )
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exitCode = 1;
});
