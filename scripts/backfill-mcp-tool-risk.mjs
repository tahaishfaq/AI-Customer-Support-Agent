import prisma from "@/lib/prisma";
import { detectMcpWriteRisk, stricterMcpRisk } from "@/lib/mcp/client";

// Tighten stored MCP tools whose name shows a side effect but whose risk is lower.
// Tighten-only (annotations are not stored); a re-probe applies full classification.
const apply = process.argv.includes("--apply");

async function main() {
  const tools = await prisma.agentMcpTool.findMany({
    select: { id: true, name: true, riskLevel: true, requiresConfirmation: true },
  });

  const changes = [];
  for (const tool of tools) {
    const detected = detectMcpWriteRisk(tool.name);
    if (!detected) continue;
    const riskLevel = stricterMcpRisk(tool.riskLevel, detected);
    if (riskLevel === tool.riskLevel && tool.requiresConfirmation) continue;
    changes.push({ id: tool.id, name: tool.name, from: tool.riskLevel, to: riskLevel });
    if (apply) {
      await prisma.agentMcpTool.update({
        where: { id: tool.id },
        data: { riskLevel, requiresConfirmation: true },
      });
    }
  }

  const byName = {};
  for (const change of changes) byName[`${change.name}: ${change.from}→${change.to}`] = (byName[`${change.name}: ${change.from}→${change.to}`] || 0) + 1;
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", scanned: tools.length, changed: changes.length, byName }, null, 2));
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
