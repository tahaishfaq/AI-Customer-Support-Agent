import "dotenv/config";
import { actionsToOpenAiTools } from "../lib/actions/tool-definitions.js";

const prisma = (await import("../lib/prisma.js")).default;
const id = "cmt5he44d0000loi1a75lv80f";
const actions = await prisma.agentAction.findMany({
  where: { agentId: id, enabled: true },
  select: { name: true, description: true, inputSchemaJson: true },
});
console.log("count", actions.length);
for (const a of actions) {
  console.log("---", a.name);
  console.log(JSON.stringify(a.inputSchemaJson));
}
try {
  const tools = actionsToOpenAiTools(actions);
  console.log("openai tools ok", tools.length);
  console.log(JSON.stringify(tools.slice(0, 2), null, 2));
} catch (e) {
  console.error("toTools failed", e.message);
}
await prisma.$disconnect();
