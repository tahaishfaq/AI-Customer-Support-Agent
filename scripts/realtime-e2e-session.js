import "dotenv/config";
import { issueOwnerRealtimeSession, revokeRealtimeSession } from "../lib/realtime/session.service.js";
import prisma from "../lib/prisma.js";

async function main() {
  const action = process.argv[2] || "issue";
  try {
    if (action === "issue") {
      const user = await prisma.user.findFirst({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      if (!user?.id) throw new Error("An active user is required for browser realtime E2E");
      const session = await issueOwnerRealtimeSession({
        userId: user.id,
        deviceLabel: `playwright-${process.pid}`,
      });
      console.log(JSON.stringify({ userId: user.id, ...session }));
      return;
    }

    if (action === "revoke") {
      const userId = process.argv[3];
      const sessionId = process.argv[4];
      if (!userId || !sessionId) throw new Error("userId and sessionId are required");
      await revokeRealtimeSession({ userId, sessionId });
      return;
    }

    throw new Error(`Unknown realtime E2E session action: ${action}`);
  } finally {
    await prisma.$disconnect?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
