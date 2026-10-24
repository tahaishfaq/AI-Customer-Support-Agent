/**
 * Detect legacy unsafe GraphQL-over-POST templates (AIDE-GAP-003).
 * Do not silent-migrate — block publish/execute when injection placeholders exist.
 */

const INJECTION_RE =
  /\{\{\s*(query|graphql|document|operation|gql)\s*\}\}/i;

/**
 * @param {{ urlTemplate?: string, requestBodyTemplate?: unknown, protocol?: string }} action
 */
export function detectUnsafeGraphqlBodyInjection(action) {
  const protocol = String(action?.protocol || "REST_JSON").toUpperCase();
  const url = String(action?.urlTemplate || "").toLowerCase();
  const looksGraphql =
    protocol === "GRAPHQL" ||
    url.includes("/graphql") ||
    url.includes("graphql?");

  const body = action?.requestBodyTemplate;
  const bodyText =
    typeof body === "string"
      ? body
      : body != null
        ? JSON.stringify(body)
        : "";

  if (!looksGraphql && !INJECTION_RE.test(bodyText)) {
    return { unsafe: false };
  }

  if (INJECTION_RE.test(bodyText) || INJECTION_RE.test(String(action?.urlTemplate || ""))) {
    return {
      unsafe: true,
      reason:
        "CONFIG_REVIEW_REQUIRED: GraphQL operation must be stored fixed on the action (protocol=GRAPHQL + graphqlOperation). Remove {{query}}/{{graphql}}/{{document}} placeholders — the AI may only supply variables.",
    };
  }

  if (looksGraphql && protocol !== "GRAPHQL") {
    return {
      unsafe: true,
      reason:
        "CONFIG_REVIEW_REQUIRED: URL looks like GraphQL but protocol is not GRAPHQL. Migrate to protocol=GRAPHQL with a fixed stored operation.",
    };
  }

  return { unsafe: false };
}
