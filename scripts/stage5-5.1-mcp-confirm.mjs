/**
 * Stage 5.1 — MCP confirmation hardening tests.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage5-5.1-mcp-confirm.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const { hashArgs } = await import("../lib/actions/identity.js");
const {
  createPendingConfirmation,
  approveConfirmation,
  denyConfirmation,
  claimApprovedConfirmation,
  getApprovedConfirmation,
} = await import("../lib/services/confirmation.service.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "5.1", ...row });
}
function pass(id, evidence, actual = {}) {
  record({ id, status: "PASS", evidence, actual });
}
function fail(id, evidence, actual = {}) {
  record({ id, status: "FAIL", evidence, actual });
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// Static evidence
{
  const svc = read("lib/services/confirmation.service.js");
  const mig = read(
    "prisma/migrations/20260904190000_confirmation_hardening/migration.sql"
  );
  if (
    /updateMany/.test(svc) &&
    /CONSUMED/.test(svc) &&
    /isUniqueViolation|P2002/.test(svc) &&
    /loadCallableCapability/.test(svc) &&
    /pending_mcp_uniq/.test(mig)
  ) {
    pass(
      "S5.1-STATIC",
      "Optimistic claim lock + unique PENDING indexes + capability re-check present"
    );
  } else {
    fail("S5.1-STATIC", "Missing hardening evidence");
  }
}

if (!process.env.DATABASE_URL) {
  fail("S5.1-DB", "DATABASE_URL missing");
} else {
  const prisma = (await import("../lib/prisma.js")).default;
  let serverId = null;
  let toolId = null;
  let convId = null;
  let agentId = null;

  try {
    const agent = await prisma.agent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!agent) throw new Error("No agent in DB");
    agentId = agent.id;

    let conv = await prisma.conversation.findFirst({
      where: { agentId },
      select: { id: true, agentId: true, customerSubject: true },
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          agentId,
          source: "STUDIO",
          customerSubject: "stage5.1-test",
        },
        select: { id: true, agentId: true, customerSubject: true },
      });
    }
    convId = conv.id;

    const stamp = Date.now();
    const server = await prisma.agentMcpServer.create({
      data: {
        agentId,
        name: `stage5-1-${stamp}`,
        transport: "HTTP",
        url: "https://example.com/mcp",
        frozenHost: "example.com",
        authType: "NONE",
        enabled: true,
      },
    });
    serverId = server.id;

    const tool = await prisma.agentMcpTool.create({
      data: {
        serverId: server.id,
        name: "stage5_write",
        functionName: "stage5_write",
        description: "Stage 5.1 ephemeral WRITE tool",
        enabled: true,
        riskLevel: "WRITE",
        requiresConfirmation: true,
        inputSchemaJson: {
          type: "object",
          properties: { n: { type: "integer" } },
          required: ["n"],
        },
      },
    });
    toolId = tool.id;

    const ref = { mcpToolId: toolId };

    // MCP pending create
    const args = { n: stamp };
    const p1 = await createPendingConfirmation(convId, ref, args);
    const p2 = await createPendingConfirmation(convId, ref, args);
    if (p1.id === p2.id && p1.mcpToolId === toolId && p1.status === "PENDING") {
      pass("S5.1-MCP-PENDING-IDEMPOTENT", "Same PENDING reused for identical argsHash");
    } else {
      fail("S5.1-MCP-PENDING-IDEMPOTENT", "Pending not idempotent", { p1, p2 });
    }

    // Parallel create race
    const argsRace = { n: stamp, race: true };
    const created = await Promise.all(
      Array.from({ length: 8 }, () =>
        createPendingConfirmation(convId, ref, argsRace)
      )
    );
    const ids = new Set(created.map((c) => c.id));
    const pendingCount = await prisma.actionConfirmation.count({
      where: {
        conversationId: convId,
        mcpToolId: toolId,
        argsHash: hashArgs(argsRace),
        status: "PENDING",
      },
    });
    if (ids.size === 1 && pendingCount === 1) {
      pass(
        "S5.1-MCP-CREATE-RACE",
        "8 parallel creates → exactly 1 PENDING row",
        { id: [...ids][0] }
      );
    } else {
      fail("S5.1-MCP-CREATE-RACE", "Duplicate PENDING under race", {
        uniqueIds: ids.size,
        pendingCount,
      });
    }

    // Approve + parallel claim race
    const argsClaim = { n: stamp, claim: true };
    const pending = await createPendingConfirmation(convId, ref, argsClaim);
    await approveConfirmation(pending.id, convId, {
      userSubject: conv.customerSubject || "stage5.1",
    });
    const h = hashArgs(argsClaim);
    const claims = await Promise.all(
      Array.from({ length: 10 }, () =>
        claimApprovedConfirmation(convId, ref, h, { expectedAgentId: agentId })
      )
    );
    const winners = claims.filter(Boolean);
    if (winners.length === 1) {
      pass(
        "S5.1-MCP-CLAIM-RACE",
        "10 parallel claims → exactly 1 winner (CONSUMED)"
      );
    } else {
      fail("S5.1-MCP-CLAIM-RACE", "Claim race not exclusive", {
        winners: winners.length,
      });
    }

    const replay = await claimApprovedConfirmation(convId, ref, h, {
      expectedAgentId: agentId,
    });
    if (!replay) {
      pass("S5.1-MCP-REPLAY", "Post-consume replay rejected");
    } else {
      fail("S5.1-MCP-REPLAY", "Replay allowed", replay);
    }

    // Wrong argsHash
    const wrong = await getApprovedConfirmation(
      convId,
      ref,
      hashArgs({ n: stamp, claim: false }),
      { expectedAgentId: agentId }
    );
    if (!wrong) {
      pass("S5.1-MCP-WRONG-ARGS", "Wrong argsHash rejected");
    } else {
      fail("S5.1-MCP-WRONG-ARGS", "Wrong hash accepted");
    }

    // Wrong agent
    const argsAg = { n: stamp, agent: true };
    const pendAg = await createPendingConfirmation(convId, ref, argsAg);
    await approveConfirmation(pendAg.id, convId, {});
    const badAgent = await claimApprovedConfirmation(
      convId,
      ref,
      hashArgs(argsAg),
      { expectedAgentId: "not-the-agent" }
    );
    if (!badAgent) {
      pass("S5.1-MCP-WRONG-AGENT", "expectedAgentId mismatch rejected");
    } else {
      fail("S5.1-MCP-WRONG-AGENT", "Wrong agent claim allowed");
    }

    // Expired
    const argsEx = { n: stamp, exp: true };
    const pendEx = await createPendingConfirmation(convId, ref, argsEx);
    await prisma.actionConfirmation.update({
      where: { id: pendEx.id },
      data: {
        status: "APPROVED",
        expiresAt: new Date(Date.now() - 2000),
        decidedAt: new Date(),
      },
    });
    const expired = await claimApprovedConfirmation(
      convId,
      ref,
      hashArgs(argsEx),
      { expectedAgentId: agentId }
    );
    if (!expired) {
      pass("S5.1-MCP-EXPIRED", "Expired APPROVED not claimable");
    } else {
      fail("S5.1-MCP-EXPIRED", "Expired claimed");
    }

    // Disabled MCP tool cannot be claimed
    const argsDis = { n: stamp, dis: true };
    const pendDis = await createPendingConfirmation(convId, ref, argsDis);
    await approveConfirmation(pendDis.id, convId, {});
    await prisma.agentMcpTool.update({
      where: { id: toolId },
      data: { enabled: false },
    });
    const disabledClaim = await claimApprovedConfirmation(
      convId,
      ref,
      hashArgs(argsDis),
      { expectedAgentId: agentId }
    );
    if (!disabledClaim) {
      pass(
        "S5.1-MCP-DISABLED-AT-CLAIM",
        "Disabled MCP tool cannot be claimed after approve"
      );
    } else {
      fail("S5.1-MCP-DISABLED-AT-CLAIM", "Disabled tool still claimed");
    }
    await prisma.agentMcpTool.update({
      where: { id: toolId },
      data: { enabled: true },
    });

    // Deny path
    const argsDeny = { n: stamp, deny: true };
    const pendDeny = await createPendingConfirmation(convId, ref, argsDeny);
    await denyConfirmation(pendDeny.id, convId, {});
    const denied = await claimApprovedConfirmation(
      convId,
      ref,
      hashArgs(argsDeny),
      { expectedAgentId: agentId }
    );
    if (!denied) {
      pass("S5.1-MCP-DENY", "DENIED confirmation not claimable");
    } else {
      fail("S5.1-MCP-DENY", "Denied claimable");
    }

    // MCP READ does not require confirm in policy (structural)
    const { evaluateActionPolicy } = await import("../lib/actions/policy.js");
    const readPol = evaluateActionPolicy({
      action: { riskLevel: "READ", requiresConfirmation: false },
      publicAccess: false,
      confirmationStatus: null,
    });
    if (readPol.allow) {
      pass("S5.1-MCP-READ-UNCHANGED", "Studio READ still allowed without confirm");
    } else {
      fail("S5.1-MCP-READ-UNCHANGED", "READ unexpectedly blocked", readPol);
    }
  } catch (err) {
    fail("S5.1-DB-ERROR", String(err?.message || err));
  } finally {
    // Cleanup ephemeral MCP server (cascades tools + confirmations via FK)
    try {
      if (serverId) {
        await prisma.agentMcpServer.delete({ where: { id: serverId } });
      }
    } catch {
      /* ignore */
    }
  }
}

fs.mkdirSync(outDir, { recursive: true });
const failures = results.filter((r) => r.status === "FAIL");
const report = `# Stage 5.1 — MCP Confirmation Hardening

Generated: ${new Date().toISOString()}

## Verdict: **${failures.length ? "FAIL" : "PASS"}**

| PASS | FAIL | TOTAL |
| ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.length} |

## What changed

- Atomic approve (\`PENDING\` → \`APPROVED|DENIED\` via \`updateMany\`)
- Atomic claim via optimistic \`updateMany(status=APPROVED → CONSUMED)\` (Neon pooler-safe; parallel claim → one winner)
- Unique partial indexes for PENDING HTTP/MCP + argsHash (create race-safe)
- Expire stale **APPROVED** as well as PENDING
- Re-check capability still enabled + agent-bound at approve and claim
- Live ephemeral MCP WRITE tool suite (create/claim races, replay, expiry, deny, disabled)

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${f.evidence}`).join("\n") : "- None"}

## Files

- \`lib/services/confirmation.service.js\`
- \`prisma/migrations/20260904190000_confirmation_hardening/migration.sql\`
- \`prisma/schema.prisma\` (index)
- \`scripts/stage5-5.1-mcp-confirm.mjs\`

## Gate

- Next Stage 5 step only on request: **5.2 Injection Boundary**
`;

fs.writeFileSync(path.join(outDir, "stage5-5.1-report.md"), report);
fs.writeFileSync(
  path.join(outDir, "stage5-5.1-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage5-5.1-failures.json"),
  JSON.stringify(failures, null, 2)
);
console.log(report);
process.exit(failures.length ? 1 : 0);
