import "dotenv/config";
import prisma from "../lib/prisma.js";

const agents = await prisma.agent.findMany({
  where: { NOT: { publicKey: null } },
  orderBy: { updatedAt: "desc" },
  take: 25,
  select: {
    id: true,
    name: true,
    enabled: true,
    actionsEnabled: true,
    webSearchEnabled: true,
    publicKey: true,
    _count: { select: { knowledgeDocs: true, httpTools: true, mcpServers: true } },
  },
});

for (const a of agents) {
  console.log(
    [
      a.enabled ? "ON" : "off",
      "act=" + a.actionsEnabled,
      "web=" + a.webSearchEnabled,
      "docs=" + a._count.knowledgeDocs,
      "http=" + a._count.httpTools,
      "mcp=" + a._count.mcpServers,
      a.name.slice(0, 40),
      "key=" + String(a.publicKey).slice(0, 6) + "…",
    ].join(" | ")
  );
}
await prisma.$disconnect();
