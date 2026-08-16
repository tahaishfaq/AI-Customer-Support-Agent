import { apiFetch } from "@/lib/api-client";

function withParams(path, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return `${path}${qs ? `?${qs}` : ""}`;
}

export async function getOverview({ agentId, range } = {}) {
  return apiFetch(withParams("/api/analytics/overview", { agentId, range }));
}

export async function getDashboard({ agentId, range } = {}) {
  return apiFetch(withParams("/api/analytics/dashboard", { agentId, range }));
}

export async function getTopics({ agentId } = {}) {
  return apiFetch(withParams("/api/analytics/topics", { agentId }));
}

export async function getSentiment({ agentId } = {}) {
  return apiFetch(withParams("/api/analytics/sentiment", { agentId }));
}

export async function getTrends({ agentId, period, days } = {}) {
  return apiFetch(
    withParams("/api/analytics/trends", { agentId, period, days })
  );
}
