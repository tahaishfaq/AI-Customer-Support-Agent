import { apiFetch } from "@/lib/api-client";

export async function getQaSettings() {
  return apiFetch("/api/workspace/qa-settings");
}

export async function saveQaSettings(settings) {
  return apiFetch("/api/workspace/qa-settings", {
    method: "PUT",
    body: JSON.stringify(settings || {}),
  });
}
