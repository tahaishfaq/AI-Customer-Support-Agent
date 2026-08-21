import { apiFetch } from "@/lib/api-client";

export async function getAdminOverview() {
  const data = await apiFetch("/api/admin/overview");
  return data.overview;
}

export async function listAdminUsers({
  q = "",
  status = "",
  role = "",
  page = 1,
  pageSize = 20,
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (role) params.set("role", role);
  if (page && Number(page) > 1) params.set("page", String(page));
  if (pageSize && Number(pageSize) !== 20) params.set("pageSize", String(pageSize));
  const query = params.toString();
  const data = await apiFetch(
    query ? `/api/admin/users?${query}` : "/api/admin/users"
  );
  return {
    users: data.users || [],
    page: data.page || 1,
    pageSize: data.pageSize || 20,
    total: data.total || 0,
    totalPages: data.totalPages || 1,
  };
}

export async function getAdminUser(id) {
  const data = await apiFetch(`/api/admin/users/${id}`);
  return data.user;
}

export async function suspendAdminUser(id) {
  const data = await apiFetch(`/api/admin/users/${id}/suspend`, {
    method: "POST",
  });
  return data.user;
}

export async function restoreAdminUser(id) {
  const data = await apiFetch(`/api/admin/users/${id}/restore`, {
    method: "POST",
  });
  return data.user;
}

export async function getAdminWorkspace(workspaceId) {
  const data = await apiFetch(`/api/admin/workspaces/${workspaceId}`);
  return data.workspace;
}

export async function getAdminAgent(agentId) {
  const data = await apiFetch(`/api/admin/agents/${agentId}`);
  return data.agent;
}

export async function setAdminAgentEnabled(agentId, enabled) {
  const data = await apiFetch(`/api/admin/agents/${agentId}/disable`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
  return data.agent;
}

export async function setAdminAgentEmbedEnabled(agentId, embedEnabled) {
  const data = await apiFetch(`/api/admin/agents/${agentId}/embed-disable`, {
    method: "POST",
    body: JSON.stringify({ embedEnabled }),
  });
  return data.agent;
}

export async function getAdminWorkspaceDashboard({
  workspaceId,
  agentId,
  range = "7d",
} = {}) {
  const params = new URLSearchParams();
  params.set("workspaceId", workspaceId);
  if (agentId) params.set("agentId", agentId);
  if (range) params.set("range", range);
  return apiFetch(`/api/admin/analytics/dashboard?${params.toString()}`);
}

export async function getAdminPlatformDashboard({ range = "7d" } = {}) {
  const params = new URLSearchParams();
  if (range) params.set("range", range);
  return apiFetch(`/api/admin/analytics/dashboard?${params.toString()}`);
}

export async function listAdminRestoreRequests({ status = "PENDING" } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const data = await apiFetch(`/api/admin/restore-requests?${params}`);
  return data.requests || [];
}

export async function decideAdminRestoreRequest(id, decision) {
  const data = await apiFetch(`/api/admin/restore-requests/${id}`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
  return data.request;
}

export async function listAdminConversations(agentId, { limit, offset } = {}) {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  const qs = params.toString();
  return apiFetch(
    `/api/admin/agents/${agentId}/conversations${qs ? `?${qs}` : ""}`
  );
}

export async function getAdminConversation(id) {
  const data = await apiFetch(`/api/admin/conversations/${id}`);
  return data.conversation;
}

export async function getAdminSettings() {
  const data = await apiFetch("/api/admin/settings");
  return data.settings;
}

export async function updateAdminSettings(patch) {
  const data = await apiFetch("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return data.settings;
}

function auditQuery({
  action = "",
  targetType = "",
  q = "",
  from = "",
  to = "",
  page = 1,
} = {}) {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (targetType) params.set("targetType", targetType);
  if (q) params.set("q", q);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (page && Number(page) > 1) params.set("page", String(page));
  return params.toString();
}

export async function listAdminAudit(filters = {}) {
  const query = auditQuery(filters);
  return apiFetch(query ? `/api/admin/audit?${query}` : "/api/admin/audit");
}

export async function exportAdminAudit(filters = {}) {
  const query = auditQuery(filters);
  return apiFetch(
    query ? `/api/admin/audit/export?${query}` : "/api/admin/audit/export"
  );
}

export async function exportAdminUser(id) {
  return apiFetch(`/api/admin/users/${id}/export`);
}

export async function deleteAdminUser(id, emailConfirm) {
  const data = await apiFetch(`/api/admin/users/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ emailConfirm }),
  });
  return data.deleted;
}
