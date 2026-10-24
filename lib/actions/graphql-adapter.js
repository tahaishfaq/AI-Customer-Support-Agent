/**
 * Safe GraphQL protocol adapter (AIDE-GAP-003).
 * Model supplies variables only — operation document is owner-stored.
 */

import { parse, Kind } from "graphql";

/**
 * @param {string} document
 * @returns {{ ok: true, operationType: "query"|"mutation", operationName: string|null } | { ok: false, error: string }}
 */
export function validateGraphQLOperationDocument(document) {
  const text = String(document || "").trim();
  if (!text) {
    return { ok: false, error: "GraphQL operation document is required" };
  }
  if (text.length > 20_000) {
    return { ok: false, error: "GraphQL operation document is too long" };
  }
  // Reject template holes that would let the model inject an operation.
  if (/\{\{\s*(query|graphql|document|operation)\s*\}\}/i.test(text)) {
    return {
      ok: false,
      error:
        "GraphQL operation must be fixed text — do not use {{query}}/{{graphql}} placeholders",
    };
  }

  let ast;
  try {
    ast = parse(text);
  } catch (err) {
    return {
      ok: false,
      error: `Invalid GraphQL: ${String(err?.message || err).slice(0, 200)}`,
    };
  }

  const ops = ast.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION);
  if (!ops.length) {
    return { ok: false, error: "GraphQL document must contain an operation" };
  }
  if (ops.length > 1) {
    return { ok: false, error: "GraphQL document must contain exactly one operation" };
  }
  const op = ops[0];
  const operationType = op.operation;
  if (operationType === "subscription") {
    return {
      ok: false,
      error: "GraphQL subscriptions are not supported on HTTP AgentAction",
    };
  }
  if (operationType !== "query" && operationType !== "mutation") {
    return { ok: false, error: `Unsupported GraphQL operation: ${operationType}` };
  }
  return {
    ok: true,
    operationType,
    operationName: op.name?.value || null,
  };
}

/**
 * Enforce mutation cannot be READ / PUBLIC_READ.
 * @returns {{ ok: true, riskLevel: string, accessClass?: string, requiresConfirmation?: boolean } | { ok: false, error: string }}
 */
export function enforceGraphQLRiskPolicy({
  operationType,
  riskLevel,
  accessClass,
  requiresConfirmation,
} = {}) {
  const risk = String(riskLevel || "READ").toUpperCase();
  const access = String(accessClass || "PUBLIC_READ").toUpperCase();
  if (operationType !== "mutation") {
    return { ok: true, riskLevel: risk, accessClass: access, requiresConfirmation };
  }
  if (risk === "READ") {
    return { ok: false, error: "GraphQL mutation cannot use riskLevel READ" };
  }
  if (access === "PUBLIC_READ" || access === "GUEST_LOOKUP") {
    return {
      ok: false,
      error: "GraphQL mutation cannot use PUBLIC_READ or GUEST_LOOKUP",
    };
  }
  const nextRisk =
    risk === "DESTRUCTIVE" || risk === "WRITE" ? risk : "WRITE";
  return {
    ok: true,
    riskLevel: nextRisk,
    accessClass: access === "ACCOUNT_WRITE" || access === "DESTRUCTIVE" ? access : "ACCOUNT_WRITE",
    requiresConfirmation: true,
  };
}

/**
 * Build GraphQL POST JSON body from stored operation + validated variables.
 */
export function buildGraphQLRequestBody({
  graphqlOperation,
  graphqlOperationName = null,
  variables = {},
} = {}) {
  const body = {
    query: String(graphqlOperation || ""),
    variables:
      variables && typeof variables === "object" && !Array.isArray(variables)
        ? variables
        : {},
  };
  const name = String(graphqlOperationName || "").trim();
  if (name) body.operationName = name;
  return body;
}

/**
 * Normalize GraphQL HTTP JSON into executor-facing status.
 * HTTP 200 alone is not success when errors[] present.
 *
 * @returns {{
 *   ok: boolean,
 *   status: "OK"|"PARTIAL"|"ERROR"|"NO_RESULT",
 *   errorCode: string|null,
 *   bodyText: string,
 *   partial: boolean,
 * }}
 */
export function normalizeGraphQLResponse(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return {
      ok: true,
      status: "NO_RESULT",
      errorCode: null,
      bodyText: "",
      partial: false,
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      status: "ERROR",
      errorCode: "CONTENT_TYPE_INVALID",
      bodyText: "GraphQL response must be JSON",
      partial: false,
    };
  }

  const errors = Array.isArray(parsed?.errors) ? parsed.errors : null;
  const hasErrors = Boolean(errors?.length);
  const data = parsed?.data;
  const hasData =
    data !== undefined &&
    data !== null &&
    !(typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 0);

  if (hasErrors && !hasData) {
    const safe = {
      errors: errors.slice(0, 5).map((e) => ({
        message: String(e?.message || "GraphQL error").slice(0, 300),
        path: e?.path ?? undefined,
      })),
    };
    return {
      ok: false,
      status: "ERROR",
      errorCode: "GRAPHQL_ERRORS",
      bodyText: JSON.stringify(safe),
      partial: false,
    };
  }

  if (hasErrors && hasData) {
    const safe = {
      data,
      errors: errors.slice(0, 5).map((e) => ({
        message: String(e?.message || "GraphQL error").slice(0, 300),
        path: e?.path ?? undefined,
      })),
      partial: true,
    };
    return {
      ok: true,
      status: "PARTIAL",
      errorCode: null,
      bodyText: JSON.stringify(safe),
      partial: true,
    };
  }

  if (!hasData) {
    return {
      ok: true,
      status: "NO_RESULT",
      errorCode: null,
      bodyText: "",
      partial: false,
    };
  }

  return {
    ok: true,
    status: "OK",
    errorCode: null,
    bodyText: JSON.stringify({ data }),
    partial: false,
  };
}
