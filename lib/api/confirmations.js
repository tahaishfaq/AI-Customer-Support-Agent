import { apiFetch } from "@/lib/api-client";

/**
 * F14-A — Owner/studio: approve or deny a pending action confirmation.
 * @param {"approve"|"deny"} decision
 */
export async function resolveConversationConfirmation(
  conversationId,
  confirmationId,
  decision = "approve",
  extra = {}
) {
  return apiFetch(
    `/api/conversations/${conversationId}/confirmations/${confirmationId}`,
    {
      method: "POST",
      body: JSON.stringify({ decision, ...extra }),
    }
  );
}

/**
 * F14-A — Embed: approve or deny (requires conversationId in body).
 */
export async function resolvePublicConfirmation(
  publicKey,
  confirmationId,
  { conversationId, decision = "approve", userSubject, userDisplay }
) {
  const res = await fetch(
    `/api/public/agents/${publicKey}/confirmations/${confirmationId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        decision,
        ...(userSubject ? { userSubject } : {}),
        ...(userDisplay ? { userDisplay } : {}),
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data?.error?.message || "Unable to resolve confirmation"
    );
    err.status = res.status;
    err.details = data?.error?.details || {};
    throw err;
  }
  return data;
}

/**
 * F14-B — Owner audit list.
 */
export async function listAgentConfirmations(agentId, { take = 30 } = {}) {
  const q = take ? `?take=${encodeURIComponent(String(take))}` : "";
  const data = await apiFetch(`/api/agents/${agentId}/confirmations${q}`);
  return data.confirmations || [];
}
