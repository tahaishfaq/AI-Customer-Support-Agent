/**
 * Aide first-party demo MCP tools (DS1).
 * Primary names use aide_demo_* prefix; legacy get_demo_time / create_demo_note stay callable.
 */

export const DEMO_MCP_SERVER_INFO = Object.freeze({
  name: "aide-demo-mcp",
  version: "0.2.0",
});

export const DEMO_MCP_PROTOCOL_VERSION = "2024-11-05";

/** @typedef {{ name: string, description: string, inputSchema: object, annotations?: object, aliasOf?: string }} DemoToolDef */

/** @type {DemoToolDef[]} */
export const DEMO_MCP_TOOLS = [
  {
    name: "aide_demo_get_time",
    description:
      "Return the current server time in a compact form. Optional IANA timezone (default UTC).",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: 'IANA timezone, e.g. "UTC" or "Asia/Karachi". Default: UTC.',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "aide_demo_create_note",
    description:
      "Create a short demo note (WRITE). Requires visitor Confirm in Aide before call.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Note body (1–500 characters).",
          minLength: 1,
          maxLength: 500,
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  // Backward-compatible aliases (same handlers). Prefer aide_demo_* for new enables.
  {
    name: "get_demo_time",
    description:
      "Alias of aide_demo_get_time (legacy). Prefer aide_demo_get_time for new agents.",
    aliasOf: "aide_demo_get_time",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: 'IANA timezone, e.g. "UTC". Default: UTC.',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "create_demo_note",
    description:
      "Alias of aide_demo_create_note (legacy). Prefer aide_demo_create_note for new agents.",
    aliasOf: "aide_demo_create_note",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Note body (1–500 characters)." },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
];

const CANONICAL = Object.freeze({
  get_demo_time: "aide_demo_get_time",
  create_demo_note: "aide_demo_create_note",
  aide_demo_get_time: "aide_demo_get_time",
  aide_demo_create_note: "aide_demo_create_note",
});

/**
 * @param {string} name
 * @returns {string|null}
 */
export function resolveDemoMcpToolName(name) {
  const key = String(name || "").trim();
  return CANONICAL[key] || null;
}

/**
 * Tools/list payload — primary tools only (aliases stay callable via tools/call).
 */
export function listDemoMcpTools() {
  return DEMO_MCP_TOOLS.filter((t) => !t.aliasOf).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    ...(t.annotations ? { annotations: t.annotations } : {}),
  }));
}

/**
 * Full definitions including legacy aliases (tests / docs).
 */
export function listDemoMcpToolsIncludingAliases() {
  return DEMO_MCP_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    ...(t.annotations ? { annotations: t.annotations } : {}),
    ...(t.aliasOf ? { aliasOf: t.aliasOf } : {}),
  }));
}

function toolError(message) {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function dualContent(markdown, data) {
  return {
    content: [
      { type: "text", text: markdown },
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
  };
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} [args]
 */
export function callDemoMcpTool(name, args = {}) {
  const canonical = resolveDemoMcpToolName(name);
  if (!canonical) {
    return toolError(
      `Unknown tool "${name}". Available: aide_demo_get_time, aide_demo_create_note (aliases: get_demo_time, create_demo_note).`
    );
  }

  if (canonical === "aide_demo_get_time") {
    const rawTz = args.timezone;
    const tz =
      rawTz == null || rawTz === ""
        ? "UTC"
        : typeof rawTz === "string"
          ? rawTz.trim()
          : null;
    if (!tz) {
      return toolError(
        'timezone must be a string IANA label (e.g. "UTC" or "Asia/Karachi"). Omit the field to use UTC.'
      );
    }
    let iso;
    let display;
    try {
      iso = new Date().toISOString();
      display = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date());
    } catch {
      return toolError(
        `Invalid timezone "${tz}". Try timezone="UTC" or a valid IANA name like "Asia/Karachi".`
      );
    }
    const data = {
      ok: true,
      timezone: tz,
      iso,
      local: display,
      source: "aide_demo_mcp",
      tool: "aide_demo_get_time",
    };
    return dualContent(
      `**Server time** (${tz}): ${display}\n\nISO: \`${iso}\``,
      data
    );
  }

  if (canonical === "aide_demo_create_note") {
    if (args.text == null || typeof args.text !== "string") {
      return toolError(
        'Missing required argument "text" (string, 1–500 chars). Example: {"text":"Follow up tomorrow"}.'
      );
    }
    const text = args.text.trim();
    if (!text) {
      return toolError(
        'text cannot be empty. Pass a short note body, e.g. {"text":"Call customer back"}.'
      );
    }
    if (text.length > 500) {
      return toolError(
        `text is too long (${text.length} chars). Keep it ≤ 500 characters.`
      );
    }
    const data = {
      ok: true,
      id: `note_${Date.now()}`,
      text,
      source: "aide_demo_mcp",
      tool: "aide_demo_create_note",
    };
    return dualContent(`**Demo note created** (\`${data.id}\`)\n\n${text}`, data);
  }

  return toolError(`Unhandled tool: ${canonical}`);
}
