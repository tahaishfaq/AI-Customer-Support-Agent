import { apiFetch } from "@/lib/api-client";

export async function listKnowledge(agentId) {
  const data = await apiFetch(`/api/agents/${agentId}/knowledge`);
  return data.documents || [];
}

export async function createTextKnowledge(agentId, { name, content }) {
  return apiFetch(`/api/agents/${agentId}/knowledge`, {
    method: "POST",
    body: JSON.stringify({
      name,
      type: "TEXT",
      content,
    }),
  });
}

export async function uploadPdfKnowledge(agentId, file, name) {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);

  const response = await fetch(`/api/agents/${agentId}/knowledge`, {
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

export async function deleteKnowledge(id) {
  return apiFetch(`/api/knowledge/${id}`, {
    method: "DELETE",
  });
}
