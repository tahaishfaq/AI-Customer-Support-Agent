import "dotenv/config";

const prisma = (await import("../lib/prisma.js")).default;
const id = "cmt5he44d0000loi1a75lv80f";

await prisma.agentAction.updateMany({
  where: { agentId: id, name: "book_class" },
  data: {
    enabled: true,
    riskLevel: "WRITE",
    requiresConfirmation: true,
    description:
      "Create a support ticket (demo). Args: subject (string), body (string). Requires user confirmation.",
    urlTemplate: "http://localhost:3000/api/demo/tickets",
    method: "POST",
    inputSchemaJson: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Ticket subject" },
        body: { type: "string", description: "Ticket body" },
      },
      required: ["subject", "body"],
      additionalProperties: false,
    },
    accessClass: "ACCOUNT_WRITE",
  },
});

console.log("book_class schema fixed");
await prisma.$disconnect();
