/**
 * F13-T3 — Minimal MCP Streamable HTTP / JSON-RPC client (no stdio).
 * Spec-shaped enough for tools/list + tools/call against remote or /api/demo/mcp.
 */
import { assertActionUrlSafe, assertActionUrlSafePinned } from "../actions/ssrf.js";
import { notifyActivity } from "../chat/activity-emitter.js";
import {
  assertFrozenHostMatch,
  extractFrozenHost,
} from "../actions/frozen-host.js";

const PROTOCOL_VERSION = "2024-11-05";
const DEFAULT_TIMEOUT_MS = 12_000;

function mcpError(status, message, code = "MCP_ERROR") {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/** Allow local demo MCP on same-origin /api/demo/mcp */
export function allowLocalDemoMcpUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || ""));
    const host = u.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    return isLocal && /\/api\/demo\/mcp\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function assertMcpUrlSafe(rawUrl, { frozenHost = null } = {}) {
  const allowLocalDemo = allowLocalDemoMcpUrl(rawUrl);
  assertActionUrlSafe(rawUrl, { allowLocalDemo });
  if (frozenHost) {
    assertFrozenHostMatch(rawUrl, frozenHost);
  }
}

/**
 * Parse JSON-RPC response from application/json or text/event-stream (data: lines).
 */
export function parseMcpHttpBody(contentType, text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw mcpError(502, "Empty MCP response", "MCP_EMPTY");
  }
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("text/event-stream") || raw.startsWith("event:") || raw.includes("\ndata:")) {
    const dataLines = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    if (!dataLines.length) {
      throw mcpError(502, "MCP SSE response missing data", "MCP_SSE");
    }
    // Prefer last JSON-RPC result frame
    let last = null;
    for (const line of dataLines) {
      try {
        last = JSON.parse(line);
      } catch {
        // ignore non-json frames
      }
    }
    if (!last) throw mcpError(502, "MCP SSE frames were not JSON", "MCP_SSE");
    return last;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw mcpError(502, "MCP response was not JSON", "MCP_PARSE");
  }
}

function authHeaders({ authType, headerName, secret }) {
  const type = String(authType || "NONE").toUpperCase();
  if (type === "NONE" || !secret) return {};
  if (type === "BEARER") {
    // Owners sometimes paste "Bearer ghp_…" — avoid Authorization: Bearer Bearer …
    const token = String(secret).replace(/^bearer\s+/i, "").trim();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }
  if (type === "HEADER") {
    const name = String(headerName || "Authorization").trim() || "Authorization";
    return { [name]: secret };
  }
  return {};
}

async function postJsonRpc({
  url,
  headers,
  method,
  params,
  id = 1,
  signal,
  sessionId = null,
  notification = false,
}) {
  const body = notification
    ? { jsonrpc: "2.0", method, params }
    : { jsonrpc: "2.0", id, method, params };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: "error",
    });

    const nextSession = res.headers.get("mcp-session-id") || sessionId;
    const text = await res.text();
    if (notification) {
      return { sessionId: nextSession, result: null };
    }
    if (!res.ok) {
      const snippet = String(text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
      const authHint =
        res.status === 401 ||
        res.status === 403 ||
        /www-authenticate/i.test(res.headers.get("www-authenticate") || "") ||
        /access token|authorization|unauthorized|forbidden/i.test(snippet);
      throw mcpError(
        res.status || 502,
        snippet || `MCP HTTP ${res.status}`,
        authHint ? "MCP_AUTH" : "MCP_HTTP"
      );
    }
    const payload = parseMcpHttpBody(res.headers.get("content-type"), text);
    if (payload?.error) {
      const msg =
        payload.error.message ||
        payload.error.data?.message ||
        `MCP error ${payload.error.code || ""}`.trim();
      throw mcpError(502, msg, "MCP_RPC");
    }
    return { sessionId: nextSession, result: payload?.result ?? payload };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw mcpError(504, "MCP request timed out", "TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

/**
 * Initialize + tools/list. Optionally DNS-pin when not local demo.
 */
export async function probeMcpServer({
  url,
  authType = "NONE",
  headerName = null,
  secret = null,
  frozenHost = null,
  signal,
}) {
  assertMcpUrlSafe(url, { frozenHost });
  if (!allowLocalDemoMcpUrl(url)) {
    await assertActionUrlSafePinned(url, { allowLocalDemo: false });
  }

  const headers = authHeaders({ authType, headerName, secret });
  const host = extractFrozenHost(url);

  let sessionId = null;
  const init = await postJsonRpc({
    url,
    headers,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "aide", version: "0.1.0" },
    },
    id: 1,
    signal,
  });
  sessionId = init.sessionId;

  await postJsonRpc({
    url,
    headers,
    method: "notifications/initialized",
    params: {},
    notification: true,
    sessionId,
    signal,
  });

  const listed = await postJsonRpc({
    url,
    headers,
    method: "tools/list",
    params: {},
    id: 2,
    sessionId,
    signal,
  });

  const tools = Array.isArray(listed.result?.tools)
    ? listed.result.tools
    : Array.isArray(listed.result)
      ? listed.result
      : [];

  return {
    frozenHost: host || frozenHost,
    serverInfo: init.result?.serverInfo || null,
    protocolVersion: init.result?.protocolVersion || PROTOCOL_VERSION,
    tools: tools.map(normalizeDiscoveredTool).filter(Boolean),
  };
}

/**
 * Call one MCP tool by remote name.
 */
export async function callMcpTool({
  url,
  authType = "NONE",
  headerName = null,
  secret = null,
  frozenHost = null,
  toolName,
  args = {},
  signal,
  onDispatch,
  dispatchSignal,
}) {
  assertMcpUrlSafe(url, { frozenHost });
  if (!allowLocalDemoMcpUrl(url)) {
    await assertActionUrlSafePinned(url, { allowLocalDemo: false });
  }

  const headers = authHeaders({ authType, headerName, secret });
  let sessionId = null;

  if (signal?.aborted) throw mcpError(499, "Request cancelled", "ABORTED");
  dispatchSignal?.throwIfAborted();
  notifyActivity(onDispatch);
  const init = await postJsonRpc({
    url,
    headers,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "aide", version: "0.1.0" },
    },
    id: 1,
    signal,
  });
  sessionId = init.sessionId;

  await postJsonRpc({
    url,
    headers,
    method: "notifications/initialized",
    params: {},
    notification: true,
    sessionId,
    signal,
  });

  dispatchSignal?.throwIfAborted();
  const called = await postJsonRpc({
    // Once tools/call is dispatched, retain its existing bounded completion.
    url,
    headers,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args && typeof args === "object" ? args : {},
    },
    id: 3,
    sessionId,
    signal,
  });

  return called.result;
}

function normalizeDiscoveredTool(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;
  return {
    name,
    description: String(raw.description || "").trim(),
    inputSchemaJson:
      raw.inputSchema && typeof raw.inputSchema === "object"
        ? raw.inputSchema
        : raw.inputSchemaJson && typeof raw.inputSchemaJson === "object"
          ? raw.inputSchemaJson
          : { type: "object", properties: {} },
    annotations:
      raw.annotations && typeof raw.annotations === "object"
        ? {
            readOnlyHint: raw.annotations.readOnlyHint === true,
            destructiveHint: raw.annotations.destructiveHint === true,
          }
        : null,
  };
}

const RISK_RANK = { READ: 0, WRITE: 1, DESTRUCTIVE: 2 };
const DESTRUCTIVE_VERBS = new Set(["delete", "destroy", "remove", "drop", "purge", "wipe", "erase", "revoke", "truncate"]);
// Side-effect verbs that mean WRITE wherever they appear in the name.
const WRITE_VERBS = new Set([
  "create", "update", "write", "send", "post", "put", "patch", "insert", "set", "add",
  "submit", "cancel", "book", "merge", "push", "fork", "dispatch", "trigger", "approve",
  "assign", "unassign", "close", "reopen", "lock", "unlock", "transfer", "rename", "move",
  "archive", "unarchive", "publish", "upload", "invite", "reply", "edit", "execute",
  "deploy", "rerun", "resolve", "dismiss", "upsert", "save", "modify", "grant", "charge",
  "refund", "pay",
]);
// Verbs that are also common nouns ("pull_request_read", "get_commit"): WRITE only as the leading verb.
const LEAD_WRITE_VERBS = new Set([
  "request", "run", "start", "stop", "restart", "comment", "review", "label", "mark",
  "star", "unstar", "pin", "unpin", "subscribe", "unsubscribe", "follow", "unfollow",
  "enable", "disable", "import", "sync", "commit", "invoke", "call", "apply",
]);
const READ_VERBS = new Set([
  "get", "list", "search", "read", "fetch", "find", "query", "describe", "show", "view",
  "lookup", "count", "check", "download", "whoami", "status", "inspect",
]);

function riskResult(riskLevel) {
  return { riskLevel, requiresConfirmation: riskLevel !== "READ" };
}

/** Side effects evident from the tool name alone, or null. Used to tighten stored rows at runtime. */
export function detectMcpWriteRisk(toolName = "") {
  const tokens = String(toolName || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((token) => DESTRUCTIVE_VERBS.has(token))) return "DESTRUCTIVE";
  if (tokens.some((token) => WRITE_VERBS.has(token)) || LEAD_WRITE_VERBS.has(tokens[0])) return "WRITE";
  return null;
}

/**
 * Fail-closed MCP risk: READ only with evidence (read verb, or the server's readOnlyHint when the
 * name has no side-effect verb). Server annotations are untrusted: they can raise risk, never
 * lower a side-effect name. Everything unrecognised is WRITE + confirmation.
 */
export function inferMcpToolRisk(toolName = "", annotations = null) {
  const fromName = detectMcpWriteRisk(toolName);
  if (fromName) return riskResult(fromName);
  const hints = annotations && typeof annotations === "object" ? annotations : {};
  if (hints.destructiveHint === true && hints.readOnlyHint !== true) return riskResult("DESTRUCTIVE");
  if (hints.readOnlyHint === true) return riskResult("READ");
  const tokens = String(toolName || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (READ_VERBS.has(tokens[0]) || READ_VERBS.has(tokens.at(-1))) return riskResult("READ");
  return riskResult("WRITE");
}

/** Stricter of two risk levels. */
export function stricterMcpRisk(a = "READ", b = "READ") {
  return (RISK_RANK[b] ?? 1) > (RISK_RANK[a] ?? 1) ? b : a;
}

/**
 * Pre-2026-09-24 name heuristic (defaulted to READ). Only used to tell a risk that was seeded
 * automatically from one an owner set by hand when reclassifying stored tools.
 */
export function legacyInferMcpToolRisk(toolName = "") {
  const n = String(toolName || "").toLowerCase();
  if (/(delete|destroy|remove|drop|purge)/.test(n)) return riskResult("DESTRUCTIVE");
  if (/(create|update|write|send|post|put|patch|insert|set_|add_|submit|cancel|book)/.test(n)) return riskResult("WRITE");
  return riskResult("READ");
}

/**
 * Stored tool → corrected risk. A row still carrying the legacy auto-seeded value is reclassified;
 * an owner override is only ever tightened, never loosened.
 * @returns {{ riskLevel: string, requiresConfirmation: boolean }}
 */
export function reclassifyStoredMcpToolRisk(tool, annotations = null) {
  const legacy = legacyInferMcpToolRisk(tool.name);
  const seeded =
    tool.riskLevel === legacy.riskLevel &&
    Boolean(tool.requiresConfirmation) === legacy.requiresConfirmation;
  if (seeded) return inferMcpToolRisk(tool.name, annotations);
  const tightened = stricterMcpRisk(tool.riskLevel, detectMcpWriteRisk(tool.name) || "READ");
  return {
    riskLevel: tightened,
    requiresConfirmation: Boolean(tool.requiresConfirmation) || tightened !== "READ",
  };
}

export function sanitizeMcpFunctionName(serverSlug, toolName) {
  const slug = String(serverSlug || "mcp")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24) || "mcp";
  const tool = String(toolName || "tool")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "tool";
  const full = `mcp_${slug}_${tool}`.slice(0, 64);
  return full;
}

export function formatMcpToolResultForModel(result) {
  if (result == null) return "(empty MCP result)";
  if (typeof result === "string") return result.slice(0, 4000);
  try {
    // MCP tools/call often returns { content: [{ type, text }], isError }
    if (Array.isArray(result.content)) {
      const texts = result.content
        .map((c) => {
          if (!c || typeof c !== "object") return "";
          if (c.type === "text") return String(c.text || "");
          return JSON.stringify(c);
        })
        .filter(Boolean);
      const joined = texts.join("\n").trim();
      if (joined) {
        const prefix = result.isError ? "[MCP error] " : "";
        return (prefix + joined).slice(0, 4000);
      }
    }
    return JSON.stringify(result).slice(0, 4000);
  } catch {
    return String(result).slice(0, 4000);
  }
}
