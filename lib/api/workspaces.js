import { apiFetch } from "@/lib/api-client";

export async function listWorkspaces() {
  return apiFetch("/api/workspaces");
}

export async function createWorkspace(payload) {
  return apiFetch("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWorkspace(id, payload) {
  return apiFetch(`/api/workspaces/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkspace(id, payload = {}) {
  return apiFetch(`/api/workspaces/${id}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export async function activateWorkspace(id) {
  return apiFetch(`/api/workspaces/${id}/activate`, {
    method: "POST",
  });
}
