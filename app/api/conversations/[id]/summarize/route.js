import { handleCopilotRequest } from "@/lib/api/copilot-route";
import { summarizeDeskConversation } from "@/lib/services/copilot.service";

/** Level 2 · M4 — short AI summary of the chat for the human taking over (not stored). */
export async function POST(request, { params }) {
  return handleCopilotRequest(request, params, summarizeDeskConversation, "summarize");
}
