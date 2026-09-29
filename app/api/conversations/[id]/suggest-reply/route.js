import { handleCopilotRequest } from "@/lib/api/copilot-route";
import { suggestDeskReply } from "@/lib/services/copilot.service";

/** Level 2 · M4 — draft the next human reply (never sent or stored). */
export async function POST(request, { params }) {
  return handleCopilotRequest(request, params, suggestDeskReply, "suggest-reply");
}
