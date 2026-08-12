import { apiFetch } from "@/lib/api-client";

export async function getOverview() {
  return apiFetch("/api/analytics/overview");
}
