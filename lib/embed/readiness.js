/** Embed checklist states: pending (grey), pass (green), fail (red), warn (amber). */

export const READINESS_STATES = Object.freeze(["pending", "pass", "fail", "warn"]);

/**
 * True when an action/MCP URL is still a local demo or documentation placeholder.
 * Live embed readiness must not report "ready" while any enabled tool matches.
 */
export function isDemoIntegrationUrl(url) {
  const raw = String(url || "").trim().toLowerCase();
  if (!raw) return false;
  if (/\/api\/demo(\/|$)/.test(raw)) return true;
  if (/\blocalhost\b|\b127\.0\.0\.1\b/.test(raw)) return true;
  // RFC 2606 / docs placeholders used by pack templates (e.g. api.example.com).
  if (/(^|[/.])example\.(com|org|net)([/:?]|$)/.test(raw)) return true;
  return false;
}

export function httpUrlNeedsOwnerArgs(urlTemplate) {
  return /\{\{\s*(?!env:|credential:)[^}]+\}\}/.test(String(urlTemplate || ""));
}

export function canSmokeHttpAction(action) {
  if (!action?.enabled) return false;
  const method = String(action.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  const risk = String(action.riskLevel || "READ").toUpperCase();
  if (risk !== "READ") return false;
  const access = String(action.accessClass || "PUBLIC_READ").toUpperCase();
  if (access === "ACCOUNT_READ" || access === "ACCOUNT_WRITE" || access === "DESTRUCTIVE") {
    return false;
  }
  return true;
}

/**
 * @param {{
 *   liveOrigin: string|null,
 *   lastPingAt: string|null,
 *   setUserSeen: boolean,
 *   embedConversations: number,
 *   needsSetUser: boolean,
 *   unsafeAccountTools?: number,
 *   actionsEnabled: boolean,
 *   integrations: Array<{ kind: string, id: string, name: string, state: string, reason: string, demo?: boolean }>,
 * }} input
 */
export function evaluateEmbedReadiness(input) {
  const live = Boolean(input.liveOrigin);
  const integrations = Array.isArray(input.integrations) ? input.integrations : [];
  const unsafeAccountTools = Number(input.unsafeAccountTools) || 0;

  const snippet = live
    ? {
        id: "snippet",
        state: "pass",
        title: "Snippet on your site",
        reason: `Live on ${stripOrigin(input.liveOrigin)}`,
      }
    : {
        id: "snippet",
        state: "pending",
        title: "Snippet on your site",
        reason: "Paste the snippet and open a page — localhost / Aide preview does not count.",
      };

  let setUser;
  if (!input.needsSetUser) {
    setUser = {
      id: "set_user",
      state: "pass",
      title: "aideChat.setUser",
      reason: "No signed-in (account) tools yet — skip until you add them.",
    };
  } else if (!live) {
    setUser = {
      id: "set_user",
      state: "pending",
      title: "aideChat.setUser",
      reason:
        "Mint an Aide-signed HS256 identity JWT from your backend, then call setUser on every page load after the visitor signs in.",
    };
  } else if (input.setUserSeen) {
    setUser = {
      id: "set_user",
      state: "pass",
      title: "aideChat.setUser",
      reason: "Seen on a live embed chat (use HS256 JWT for account tools).",
    };
  } else if (input.embedConversations > 0) {
    setUser = {
      id: "set_user",
      state: "fail",
      title: "aideChat.setUser",
      reason:
        "Live chats exist, but no visitor identity yet. Mint HS256 JWT + setUser from your backend.",
    };
  } else {
    setUser = {
      id: "set_user",
      state: "pending",
      title: "aideChat.setUser",
      reason: "Waiting for a signed-in visitor (HS256 JWT) on the widget.",
    };
  }

  const accountTools =
    unsafeAccountTools > 0
      ? {
          id: "account_tools",
          state: "fail",
          title: "Account tools configured safely",
          reason: `${unsafeAccountTools} enabled tool${unsafeAccountTools === 1 ? "" : "s"} look like customer data without ACCOUNT identity — fix access class before going live.`,
        }
      : {
          id: "account_tools",
          state: "pass",
          title: "Account tools configured safely",
          reason: input.needsSetUser
            ? "Account tools require Aide-signed identity on embed."
            : "No unsafe account-tool configs detected.",
        };

  const confirm = {
    id: "confirm",
    state: input.actionsEnabled === false ? "warn" : "pass",
    title: "Confirm before live tool calls",
    reason:
      input.actionsEnabled === false
        ? "Actions are disabled for this agent."
        : "The widget asks for Confirm before calling your API.",
  };

  const redaction = {
    id: "redaction",
    state: "warn",
    title: "Guest lookups stay redacted",
    reason: "Aide cannot see your database ACL — keep guest APIs redacted.",
  };

  const failed = integrations.filter((row) => row.state === "fail");
  const pendingProbe = integrations.filter((row) => row.state === "pending");
  const livePass = integrations.some((row) => row.state === "pass" && !row.demo);
  const demoHits = integrations.filter((row) => row.demo);

  let integrationsCheck;
  if (input.actionsEnabled === false) {
    integrationsCheck = {
      id: "integrations",
      state: "pass",
      title: "HTTP / MCP integrations",
      reason: "HTTP actions are off. Turn them on in Tools when you need live APIs.",
    };
  } else if (!integrations.length) {
    integrationsCheck = {
      id: "integrations",
      state: "pass",
      title: "HTTP / MCP integrations",
      reason: "No HTTP GET or MCP servers to probe — widget + knowledge is enough.",
    };
  } else if (demoHits.length) {
    // Any enabled demo/placeholder tool blocks live readiness, even if another
    // action already probed successfully.
    integrationsCheck = {
      id: "integrations",
      state: "fail",
      title: "HTTP / MCP integrations",
      reason: `${demoHits.length} tool${demoHits.length === 1 ? "" : "s"} still use demo, localhost, or example.com URLs — point them at your API before going live.`,
    };
  } else if (pendingProbe.length && !failed.length) {
    integrationsCheck = {
      id: "integrations",
      state: "pending",
      title: "HTTP / MCP integrations",
      reason: "Run a live-site load or tap Re-test.",
    };
  } else if (failed.length) {
    integrationsCheck = {
      id: "integrations",
      state: "fail",
      title: "HTTP / MCP integrations",
      reason: `${failed.length} connection${failed.length === 1 ? "" : "s"} failed.`,
    };
  } else if (livePass) {
    integrationsCheck = {
      id: "integrations",
      state: "pass",
      title: "HTTP / MCP integrations",
      reason: "Reachable from Aide.",
    };
  } else {
    integrationsCheck = {
      id: "integrations",
      state: "pass",
      title: "HTTP / MCP integrations",
      reason: "Write / account tools are not auto-probed.",
    };
  }

  const checks = [snippet, setUser, accountTools, confirm, redaction, integrationsCheck];
  const parts = [
    {
      id: "site",
      title: "On your site",
      state: snippet.state,
      items: [snippet],
    },
    {
      id: "identity",
      title: "Visitor identity",
      state:
        setUser.state === "fail" || accountTools.state === "fail"
          ? "fail"
          : setUser.state === "pending"
            ? "pending"
            : setUser.state,
      items: [setUser, accountTools, confirm, redaction],
    },
    {
      id: "tools",
      title: "HTTP tools",
      state: integrationsCheck.state,
      items: [
        integrationsCheck,
        ...integrations.map((row) => ({
          id: `${row.kind}:${row.id}`,
          title: row.name,
          state: row.state,
          reason: row.reason,
        })),
      ],
    },
  ];

  // Advice only (warn/pass): never changes `ready` or the fail alert.
  if (input.setup) parts.push(evaluateAgentSetup(input.setup));

  const toolsOk =
    input.actionsEnabled === false || integrationsCheck.state === "pass";
  const ready =
    snippet.state === "pass" &&
    setUser.state !== "fail" &&
    accountTools.state !== "fail" &&
    toolsOk;

  return {
    ready,
    liveOrigin: input.liveOrigin,
    lastPingAt: input.lastPingAt,
    checks,
    parts,
    integrations,
  };
}

/** MCP tools offered per message (tool-shortlist); more than this are chosen by keyword. */
export const SETUP_MCP_TOOLS_PER_MESSAGE = 12;
export const SETUP_PROMPT_CAP = 4_000;
export const SETUP_PROMPT_WARN_AT = 3_600;

/**
 * Agent setup advice for the owner (B7). Every item is "warn" or "pass" — setup quality never
 * blocks the embed checklist.
 * @param {{
 *   knowledgeDocs?: number,
 *   promptChars?: number,
 *   embedEnabled?: boolean,
 *   mcpServers?: Array<{ name?: string, enabledTools?: number, writeToolNames?: string[], authFailed?: boolean }>,
 * }} input
 */
export function evaluateAgentSetup(input = {}) {
  const items = [];
  const docs = Number(input.knowledgeDocs) || 0;
  items.push(
    docs > 0
      ? { id: "setup_knowledge", state: "pass", title: "Knowledge", reason: `${docs} document${docs === 1 ? "" : "s"} loaded.` }
      : {
          id: "setup_knowledge",
          state: "warn",
          title: "Knowledge",
          reason: "No knowledge yet — business questions can only be answered by tools. Add documents or crawl your site.",
        }
  );

  const promptChars = Number(input.promptChars) || 0;
  items.push(
    promptChars >= SETUP_PROMPT_WARN_AT
      ? {
          id: "setup_prompt",
          state: "warn",
          title: "System prompt length",
          reason: `${promptChars.toLocaleString("en-US")} of ${SETUP_PROMPT_CAP.toLocaleString("en-US")} characters — text past the limit is cut. Drop rules the platform already enforces (secrets, untrusted data, confirmation).`,
        }
      : { id: "setup_prompt", state: "pass", title: "System prompt length", reason: `${promptChars.toLocaleString("en-US")} of ${SETUP_PROMPT_CAP.toLocaleString("en-US")} characters.` }
  );

  const largeDocs = Number(input.largeKnowledgeDocs) || 0;
  if (largeDocs > 0) {
    items.push({
      id: "setup_knowledge_chunk_cap",
      state: "warn",
      title: "Large knowledge documents",
      reason: `${largeDocs} document${largeDocs === 1 ? "" : "s"} exceed the embed chunk cap — only a head/tail sample is embedded when semantic RAG is on.`,
    });
  }

  const brokenProcedures = Array.isArray(input.brokenProcedureTools)
    ? input.brokenProcedureTools
    : [];
  if (brokenProcedures.length) {
    items.push({
      id: "setup_procedure_tools",
      state: "warn",
      title: "Broken procedure tools",
      reason: `Procedures reference missing tools: ${brokenProcedures
        .slice(0, 3)
        .map((row) => row.toolName)
        .join(", ")}${brokenProcedures.length > 3 ? "…" : ""}.`,
    });
  }

  for (const [index, server] of (Array.isArray(input.mcpServers) ? input.mcpServers : []).entries()) {
    const name = String(server?.name || "MCP server").slice(0, 60);
    const enabledTools = Number(server?.enabledTools) || 0;
    if (server?.authFailed) {
      items.push({
        id: `setup_mcp_auth_${index}`,
        state: "warn",
        title: `${name}: sign-in failed`,
        reason: "The server rejected the saved credential, so chats cannot use its tools. Reconnect it under Tools → MCP.",
      });
    }
    if (enabledTools > SETUP_MCP_TOOLS_PER_MESSAGE) {
      items.push({
        id: `setup_mcp_many_${index}`,
        state: "warn",
        title: `${name}: ${enabledTools} tools on`,
        reason: `Each message offers the ${SETUP_MCP_TOOLS_PER_MESSAGE} best keyword matches, so the right tool can be missed. Turn off the tools this agent does not need.`,
      });
    }
    const writes = Array.isArray(server?.writeToolNames) ? server.writeToolNames : [];
    if (input.embedEnabled && writes.length) {
      items.push({
        id: `setup_mcp_writes_${index}`,
        state: "warn",
        title: `${name}: ${writes.length} tool${writes.length === 1 ? "" : "s"} can change data`,
        reason: `Visitors can ask for ${writes.slice(0, 3).join(", ")}${writes.length > 3 ? ` and ${writes.length - 3} more` : ""}. Each still needs Confirm, but a support agent rarely needs them — turn off the ones you do not use.`,
      });
    }
  }

  return {
    id: "setup",
    title: "Agent setup",
    state: items.some((item) => item.state === "warn") ? "warn" : "pass",
    items,
  };
}

function stripOrigin(url) {
  try {
    return new URL(url).host;
  } catch {
    return String(url || "");
  }
}
