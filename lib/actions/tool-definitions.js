/**
 * Map AgentAction rows → OpenAI function tools + light arg validation.
 */

const TYPE_MAP = {
  string: "string",
  number: "number",
  integer: "integer",
  boolean: "boolean",
  object: "object",
  array: "array",
};

/**
 * Convert owner inputSchemaJson ({ orderId: "string" } or JSON Schema) to OpenAI parameters.
 * @param {unknown} inputSchemaJson
 */
export function inputSchemaToParameters(inputSchemaJson) {
  if (
    inputSchemaJson &&
    typeof inputSchemaJson === "object" &&
    !Array.isArray(inputSchemaJson) &&
    inputSchemaJson.type === "object" &&
    inputSchemaJson.properties
  ) {
    return {
      type: "object",
      properties: inputSchemaJson.properties,
      required: Array.isArray(inputSchemaJson.required)
        ? inputSchemaJson.required
        : Object.keys(inputSchemaJson.properties),
      additionalProperties: false,
    };
  }

  const properties = {};
  const required = [];
  const source =
    inputSchemaJson &&
    typeof inputSchemaJson === "object" &&
    !Array.isArray(inputSchemaJson)
      ? inputSchemaJson
      : {};

  for (const [key, raw] of Object.entries(source)) {
    if (!key || key === "type" || key === "properties" || key === "required") {
      continue;
    }
    const typeName =
      typeof raw === "string"
        ? TYPE_MAP[raw.toLowerCase()] || "string"
        : raw && typeof raw === "object" && raw.type
          ? TYPE_MAP[String(raw.type).toLowerCase()] || "string"
          : "string";
    properties[key] = { type: typeName };
    required.push(key);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * Short system-prompt add-on when tools are available.
 */
export function toolsPromptAddon(actionNames = []) {
  if (!actionNames.length) return "";
  const list = actionNames.join(", ");
  const hasHandoff = actionNames.includes("request_handoff");
  const lines = [
    "## Live actions (tools)",
    `You may call these server tools when the user needs live data the knowledge base cannot provide: ${list}.`,
    "Prefer knowledge for FAQs and policies. Use a tool only when a live lookup is needed.",
    "If the user gives a campaign/order name (e.g. Hel) but the tool needs an id, search/list first or ask for the id — never invent ids.",
    "For Brandly: call list_brandly_campaigns with the name, then get_brandly_campaign with the returned _id.",
    "When the user asks only for status, answer briefly with status (and name if useful). Do not paste the full tool JSON, profile picture, or every field unless they ask for full details.",
    "CRITICAL: Answer ONLY what the user asked. No unsolicited additional details, bullet lists of extra fields, or 'here are more details' sections.",
    "If a required argument is missing, ask the user — do not invent ids or API results.",
    "Never mention tool names, HTTP, or internal errors to the user; summarize results in plain language.",
  ];
  if (hasHandoff) {
    lines.push(
      "When you cannot resolve the issue after a clear attempt, call request_handoff with a short reason instead of inventing an answer. Prefer that over saying you are helpless."
    );
  }
  return lines.join(" ");
}

/**
 * @param {Array<{ name: string, description: string, inputSchemaJson?: unknown }>} actions
 */
export function actionsToOpenAiTools(actions) {
  if (!Array.isArray(actions) || !actions.length) return [];
  return actions.map((action) => ({
    type: "function",
    function: {
      name: action.name,
      description: String(action.description || action.name).slice(0, 500),
      parameters: inputSchemaToParameters(
        action.inputSchema ?? action.inputSchemaJson
      ),
    },
  }));
}

/**
 * Validate tool args against the action's simple/JSON schema.
 * @returns {{ ok: true, args: Record<string, unknown> } | { ok: false, error: string }}
 */
export function validateToolArgs(inputSchemaJson, rawArgs) {
  let args = rawArgs;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return { ok: false, error: "Tool arguments must be valid JSON" };
    }
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, error: "Tool arguments must be an object" };
  }

  const params = inputSchemaToParameters(inputSchemaJson);
  const out = {};
  for (const key of Object.keys(params.properties || {})) {
    if (!Object.prototype.hasOwnProperty.call(args, key)) {
      if ((params.required || []).includes(key)) {
        return { ok: false, error: `Missing required argument: ${key}` };
      }
      continue;
    }
    const expected = params.properties[key]?.type || "string";
    const value = args[key];
    if (!valueMatchesType(value, expected)) {
      return {
        ok: false,
        error: `Argument ${key} must be ${expected}`,
      };
    }
    out[key] = value;
  }
  return { ok: true, args: out };
}

function valueMatchesType(value, type) {
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && !Number.isNaN(value);
  if (type === "integer")
    return typeof value === "number" && Number.isInteger(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  return true;
}
