import { apiFetch } from "@/lib/api-client";

/** Level 2 · P7 — API keys and webhooks for the active workspace (Owner/Admin). */
export async function listApiKeys() {
  return apiFetch("/api/developer/api-keys");
}

export async function createApiKey(name) {
  return apiFetch("/api/developer/api-keys", { method: "POST", body: JSON.stringify({ name }) });
}

export async function revokeApiKey(id) {
  return apiFetch(`/api/developer/api-keys/${id}`, { method: "DELETE" });
}

export async function listWebhooks() {
  return apiFetch("/api/developer/webhooks");
}

export async function createWebhook(payload) {
  return apiFetch("/api/developer/webhooks", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateWebhook(id, patch) {
  return apiFetch(`/api/developer/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteWebhook(id) {
  return apiFetch(`/api/developer/webhooks/${id}`, { method: "DELETE" });
}

export async function sendTestWebhook(id) {
  return apiFetch(`/api/developer/webhooks/${id}/test`, { method: "POST" });
}

export async function rotateWebhookSecret(id) {
  return apiFetch(`/api/developer/webhooks/${id}/rotate-secret`, { method: "POST" });
}

export async function listWebhookDeliveries(id) {
  return apiFetch(`/api/developer/webhooks/${id}/deliveries`);
}
