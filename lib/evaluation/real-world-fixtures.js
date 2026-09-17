import { TENANT_FIXTURES } from "./tenant-fixtures.js";

const REQUIRED_FIELDS = [
  "id",
  "category",
  "severity",
  "companyPack",
  "workspaceId",
  "agentId",
  "customerId",
  "preconditions",
  "conversation",
  "expectedRoute",
  "allowedTools",
  "forbiddenTools",
  "expectedBinding",
  "mockResponse",
  "injectedFault",
  "expectedEvidence",
  "expectedConfirmation",
  "expectedOperationCount",
  "expectedStates",
  "outputAssertions",
  "uiAssertions",
  "cleanup",
  "contract",
];

function fixtureFor(index) {
  return TENANT_FIXTURES[index % TENANT_FIXTURES.length];
}

function testCase(id, category, contract, index, overrides = {}) {
  const fixture = fixtureFor(index);
  return {
    id,
    category,
    severity: category === "identity" || category === "writes" ? "P0" : "P1",
    companyPack: `synthetic-${fixture.pack.toLowerCase()}`,
    workspaceId: fixture.workspaceId,
    agentId: fixture.agentId,
    customerId: fixture.customerId,
    preconditions: [],
    conversation: [],
    expectedRoute: "GENERAL",
    allowedTools: [],
    forbiddenTools: [],
    expectedBinding: {},
    mockResponse: {},
    injectedFault: null,
    expectedEvidence: [],
    expectedConfirmation: null,
    expectedOperationCount: 0,
    expectedStates: {},
    outputAssertions: [],
    uiAssertions: [],
    cleanup: ["synthetic fixture only"],
    contract,
    ...overrides,
  };
}

export const REAL_WORLD_FIXTURE_VERSION = "gate4-2026-09-16-v1";

/**
 * Gate 4's first 50 cases. These are sanitized contract fixtures: no customer
 * transcripts, provider credentials, remote writes, or live response bodies.
 */
export const REAL_WORLD_GATE4_CASES = Object.freeze([
  testCase("R01", "routing", "store_roman_urdu", 0, { expectedRoute: "STORE" }),
  testCase("R02", "routing", "explicit_web", 1, { expectedRoute: "WEB" }),
  testCase("R03", "routing", "mixed_comparison", 2, { expectedRoute: "MIXED" }),
  testCase("R04", "routing", "general_no_web", 3, { expectedRoute: "GENERAL" }),
  testCase("R05", "routing", "store_tool_filter", 4, { expectedRoute: "STORE" }),
  testCase("R06", "routing", "empty_store_no_fallback", 5, { expectedRoute: "STORE" }),
  testCase("R07", "routing", "partial_knowledge", 6, { expectedRoute: "STORE" }),
  testCase("R08", "routing", "external_platform_web", 7, { expectedRoute: "WEB" }),
  testCase("R09", "routing", "ambiguous_price_clarify", 8, { expectedRoute: "STORE" }),
  testCase("R10", "routing", "store_web_flag_off", 9, { expectedRoute: "STORE" }),

  testCase("R11", "identity", "wrong_customer_result", 0),
  testCase("R12", "identity", "user_claim_not_authority", 1),
  testCase("R13", "identity", "guest_forged_user_id", 2),
  testCase("R14", "identity", "conversation_agent_binding", 3),
  testCase("R15", "identity", "action_agent_binding", 4),
  testCase("R16", "identity", "public_key_not_private_proof", 5),
  testCase("R17", "identity", "same_customer_cross_tenant", 6),
  testCase("R18", "identity", "model_role_claim_denied", 7),
  testCase("R19", "identity", "result_entity_mismatch", 8),
  testCase("R20", "identity", "public_customer_binding", 9),

  testCase("R21", "injection", "web_prompt_injection_fenced", 0),
  testCase("R22", "injection", "tool_prompt_injection_fenced", 1),
  testCase("R23", "injection", "document_prompt_injection_fenced", 2),
  testCase("R24", "injection", "url_exfiltration_not_authority", 3),
  testCase("R25", "injection", "secret_output_sanitized", 4),
  testCase("R26", "injection", "html_payload_fenced", 5),
  testCase("R27", "injection", "mcp_result_untrusted", 6),
  testCase("R28", "injection", "instruction_like_text_detected", 7),

  testCase("R29", "writes", "duplicate_tool_calls", 0),
  testCase("R30", "writes", "idempotent_read_retry", 1),
  testCase("R31", "writes", "non_idempotent_write_no_retry", 2),
  testCase("R32", "writes", "stop_after_confirmation", 3),
  testCase("R33", "writes", "unknown_remote_write_no_blind_retry", 4),
  testCase("R34", "writes", "successful_step_replay", 5),
  testCase("R35", "writes", "tool_budget_frozen", 6),
  testCase("R36", "writes", "timeout_safe_error", 7),
  testCase("R37", "writes", "rate_limit_safe_error", 8),
  testCase("R38", "writes", "changed_resource_invalidates_approval", 9),

  testCase("R39", "streaming", "activity_duplicate_deduped", 0),
  testCase("R40", "streaming", "activity_terminal_regression_rejected", 1),
  testCase("R41", "streaming", "closed_activity_ignores_events", 2),
  testCase("R42", "streaming", "confirmation_activity_label", 3),
  testCase("R43", "streaming", "activity_turn_binding", 4),
  testCase("R44", "streaming", "activity_sequence_order", 5),

  testCase("R45", "crawl", "private_address_blocked", 0),
  testCase("R46", "crawl", "non_https_blocked", 1),
  testCase("R47", "crawl", "crawl_origin_normalized", 2),
  testCase("R48", "crawl", "partial_knowledge_state", 3),
  testCase("R49", "crawl", "knowledge_untrusted_fence", 4),
  testCase("R50", "crawl", "result_body_budget", 5),
]);

export function validateRealWorldCaseSchema(testCaseValue) {
  const missing = REQUIRED_FIELDS.filter((field) => !(field in testCaseValue));
  if (missing.length) {
    throw new Error(`${testCaseValue.id || "unknown"} missing fields: ${missing.join(", ")}`);
  }
  if (!/^R\d{2}$/.test(testCaseValue.id)) throw new Error(`Invalid case id: ${testCaseValue.id}`);
  if (!Array.isArray(testCaseValue.preconditions) || !Array.isArray(testCaseValue.conversation)) {
    throw new Error(`${testCaseValue.id} preconditions/conversation must be arrays`);
  }
  return true;
}

export function validateRealWorldFixtureCatalog(cases = REAL_WORLD_GATE4_CASES) {
  if (cases.length < 50) throw new Error(`Expected at least 50 cases, received ${cases.length}`);
  const ids = new Set();
  for (const item of cases) {
    validateRealWorldCaseSchema(item);
    if (ids.has(item.id)) throw new Error(`Duplicate case id: ${item.id}`);
    ids.add(item.id);
  }
  return { count: cases.length, categories: [...new Set(cases.map((item) => item.category))] };
}
