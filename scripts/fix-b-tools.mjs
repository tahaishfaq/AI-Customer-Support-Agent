import "dotenv/config";

const prisma = (await import("../lib/prisma.js")).default;
const id = "cmt5he44d0000loi1a75lv80f";

await prisma.agentAction.updateMany({
  where: { agentId: id, name: "create_support_ticket" },
  data: { enabled: false },
});

const book = await prisma.agentAction.findFirst({
  where: { agentId: id, name: "book_class" },
  select: {
    name: true,
    enabled: true,
    riskLevel: true,
    requiresConfirmation: true,
    inputSchemaJson: true,
    urlTemplate: true,
    accessClass: true,
  },
});
console.log(JSON.stringify(book, null, 2));
await prisma.$disconnect();
