import { apiFetch } from "@/lib/api-client";

export async function getOverview({ agentId } = {}) {
  const params = new URLSearchParams();
  if (agentId) params.set("agentId", agentId);
  const qs = params.toString();
  return apiFetch(`/api/analytics/overview${qs ? `?${qs}` : ""}`);
}
