import { apiFetch } from "@/lib/api-client";

export async function listAgents() {
  const data = await apiFetch("/api/agents");
  return data.agents || [];
}

export async function getAgent(id) {
  return apiFetch(`/api/agents/${id}`);
}

export async function createAgent(payload) {
  return apiFetch("/api/agents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAgent(id, payload) {
  return apiFetch(`/api/agents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAgent(id) {
  return apiFetch(`/api/agents/${id}`, {
    method: "DELETE",
  });
}

export async function regenerateAgentEmbed(id) {
  return apiFetch(`/api/agents/${id}/embed/regenerate`, {
    method: "POST",
  });
}

export async function uploadAgentAvatar(id, file) {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`/api/agents/${id}/avatar`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: text } };
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      const { useAuthStore } = await import("@/store/auth-store");
      if (useAuthStore.getState().user) {
        useAuthStore.getState().markSessionExpired();
      }
    }
    const message =
      data?.error?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data?.error?.details || {};
    error.data = data;
    throw error;
  }

  return data;
}
