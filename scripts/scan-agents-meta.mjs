import "dotenv/config";
import fs from "node:fs";

const prisma = (await import("../lib/prisma.js")).default;
const id = "cmt5he44d0000loi1a75lv80f";
const a = await prisma.agent.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    enabled: true,
    actionsEnabled: true,
    webSearchEnabled: true,
    publicKey: true,
    _count: {
      select: { knowledgeDocs: true, httpTools: true, mcpServers: true },
    },
  },
});
const all = await prisma.agent.findMany({
  where: { NOT: { publicKey: null }, enabled: true },
  orderBy: { updatedAt: "desc" },
  take: 10,
  select: {
    name: true,
    actionsEnabled: true,
    webSearchEnabled: true,
    _count: { select: { knowledgeDocs: true, httpTools: true } },
  },
});
fs.writeFileSync(
  ".tmp/agents-meta-scan.json",
  JSON.stringify({ focus: a, recent: all }, null, 2)
);
console.log(
  "focus",
  a?.name,
  "act",
  a?.actionsEnabled,
  "web",
  a?.webSearchEnabled,
  "docs",
  a?._count?.knowledgeDocs,
  "http",
  a?._count?.httpTools
);
for (const r of all) {
  console.log(
    r.name.slice(0, 30),
    "act=" + r.actionsEnabled,
    "web=" + r.webSearchEnabled,
    "docs=" + r._count.knowledgeDocs,
    "http=" + r._count.httpTools
  );
}
await prisma.$disconnect();
