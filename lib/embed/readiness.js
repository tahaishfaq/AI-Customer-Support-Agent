/** Embed checklist states: pending (grey), pass (green), fail (red), warn (amber). */

export const READINESS_STATES = Object.freeze(["pending", "pass", "fail", "warn"]);

export function isDemoIntegrationUrl(url) {
  const raw = String(url || "").toLowerCase();
  return (
    /\/api\/demo(\/|$)/.test(raw) ||
    /localhost|127\.0\.0\.1/.test(raw)
  );
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
 *   actionsEnabled: boolean,
 *   integrations: Array<{ kind: string, id: string, name: string, state: string, reason: string, demo?: boolean }>,
 * }} input
 */
export function evaluateEmbedReadiness(input) {
  const live = Boolean(input.liveOrigin);
  const integrations = Array.isArray(input.integrations) ? input.integrations : [];

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
      reason: "Call setUser on every page load after the visitor signs in.",
    };
  } else if (input.setUserSeen) {
    setUser = {
      id: "set_user",
      state: "pass",
      title: "aideChat.setUser",
      reason: "Seen on a live embed chat.",
    };
  } else if (input.embedConversations > 0) {
    setUser = {
      id: "set_user",
      state: "fail",
      title: "aideChat.setUser",
      reason: "Live chats exist, but no visitor identity yet.",
    };
  } else {
    setUser = {
      id: "set_user",
      state: "pending",
      title: "aideChat.setUser",
      reason: "Waiting for a signed-in visitor on the widget.",
    };
  }

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
  } else if (demoHits.length) {
    integrationsCheck = {
      id: "integrations",
      state: "warn",
      title: "HTTP / MCP integrations",
      reason: "Still pointing at demo / localhost URLs.",
    };
  } else {
    integrationsCheck = {
      id: "integrations",
      state: "pass",
      title: "HTTP / MCP integrations",
      reason: "Write / account tools are not auto-probed.",
    };
  }

  const checks = [snippet, setUser, confirm, redaction, integrationsCheck];
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
      state: setUser.state,
      items: [setUser, confirm, redaction],
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

  const toolsOk =
    input.actionsEnabled === false || integrationsCheck.state === "pass";
  const ready =
    snippet.state === "pass" && setUser.state !== "fail" && toolsOk;

  return {
    ready,
    liveOrigin: input.liveOrigin,
    lastPingAt: input.lastPingAt,
    checks,
    parts,
    integrations,
  };
}

function stripOrigin(url) {
  try {
    return new URL(url).host;
  } catch {
    return String(url || "");
  }
}
