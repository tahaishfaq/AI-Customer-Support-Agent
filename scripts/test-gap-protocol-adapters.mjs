/**
 * Protocol adapters + method policy + pagination + projection + envelope
 * (AIDE-GAP-003/004/005/006/011).
 */
import assert from "node:assert/strict";
import { validateMethodRiskAccess } from "../lib/actions/action-config.js";
import {
  validateGraphQLOperationDocument,
  enforceGraphQLRiskPolicy,
  normalizeGraphQLResponse,
  buildGraphQLRequestBody,
} from "../lib/actions/graphql-adapter.js";
import { detectUnsafeGraphqlBodyInjection } from "../lib/actions/graphql-legacy.js";
import { parseXmlSafely, isXmlContentType } from "../lib/actions/xml-adapter.js";
import {
  validatePaginationConfig,
  nextPaginationStep,
} from "../lib/actions/pagination.js";
import {
  validateResponseProjection,
  projectResponseValue,
} from "../lib/actions/response-projection.js";
import { toExecutionEnvelope } from "../lib/actions/execution-envelope.js";
import { pickPinnedAddress } from "../lib/actions/pinned-fetch.js";
import { isPrivateOrMetadataAddress } from "../lib/actions/ssrf.js";

// Methods
assert.equal(validateMethodRiskAccess({ method: "DELETE", riskLevel: "READ" }).ok, false);
assert.equal(
  validateMethodRiskAccess({
    method: "DELETE",
    riskLevel: "WRITE",
    accessClass: "PUBLIC_READ",
  }).ok,
  false
);
assert.equal(
  validateMethodRiskAccess({
    method: "PUT",
    riskLevel: "WRITE",
    accessClass: "GUEST_LOOKUP",
  }).ok,
  false
);
assert.equal(
  validateMethodRiskAccess({
    method: "PATCH",
    riskLevel: "READ",
    accessClass: "ACCOUNT_WRITE",
  }).ok,
  false
);
assert.equal(
  validateMethodRiskAccess({
    method: "PUT",
    riskLevel: "WRITE",
    accessClass: "PUBLIC_READ",
  }).ok,
  false
);
assert.equal(
  validateMethodRiskAccess({
    method: "PATCH",
    riskLevel: "WRITE",
    accessClass: "ACCOUNT_WRITE",
  }).ok,
  true
);
assert.equal(
  validateMethodRiskAccess({
    method: "DELETE",
    riskLevel: "DESTRUCTIVE",
    accessClass: "DESTRUCTIVE",
  }).ok,
  true
);
console.log("ok  method/risk policy");

// GraphQL
const q = validateGraphQLOperationDocument(`
  query GetOrder($orderId: ID!) { order(id: $orderId) { id status } }
`);
assert.equal(q.ok, true);
assert.equal(q.operationType, "query");

const mut = validateGraphQLOperationDocument(`
  mutation CancelOrder($id: ID!) { cancelOrder(id: $id) { ok } }
`);
assert.equal(mut.ok, true);
assert.equal(mut.operationType, "mutation");
assert.equal(
  enforceGraphQLRiskPolicy({
    operationType: "mutation",
    riskLevel: "READ",
    accessClass: "PUBLIC_READ",
  }).ok,
  false
);
assert.equal(
  enforceGraphQLRiskPolicy({
    operationType: "mutation",
    riskLevel: "WRITE",
    accessClass: "ACCOUNT_WRITE",
  }).ok,
  true
);
assert.equal(
  validateGraphQLOperationDocument(`query Q { x } {{query}}`).ok,
  false
);
assert.equal(
  validateGraphQLOperationDocument(`subscription S { x }`).ok,
  false
);

const body = buildGraphQLRequestBody({
  graphqlOperation: "query Q($id: ID!){ n(id:$id){id} }",
  variables: { id: "1" },
});
assert.equal(body.variables.id, "1");
assert.ok(!Object.prototype.hasOwnProperty.call(body.variables, "query"));

const gqlFail = normalizeGraphQLResponse(
  JSON.stringify({ data: null, errors: [{ message: "boom" }] })
);
assert.equal(gqlFail.ok, false);
assert.equal(gqlFail.errorCode, "GRAPHQL_ERRORS");

const gqlPartial = normalizeGraphQLResponse(
  JSON.stringify({
    data: { order: { id: "1" } },
    errors: [{ message: "partial" }],
  })
);
assert.equal(gqlPartial.ok, true);
assert.equal(gqlPartial.partial, true);
assert.equal(gqlPartial.status, "PARTIAL");

assert.equal(
  detectUnsafeGraphqlBodyInjection({
    protocol: "REST_JSON",
    urlTemplate: "https://api.example.com/graphql",
    requestBodyTemplate: { query: "{{query}}" },
  }).unsafe,
  true
);
console.log("ok  GraphQL adapter");

// XML
assert.equal(isXmlContentType("application/xml; charset=utf-8"), true);
assert.equal(parseXmlSafely("<root><status>ok</status></root>").ok, true);
assert.equal(
  parseXmlSafely(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><a>&xxe;</a>`).ok,
  false
);
assert.equal(parseXmlSafely(`<!ENTITY lol "lol">`).ok, false);
console.log("ok  XML adapter (XXE/DTD blocked)");

// Projection $. paths
const proj = validateResponseProjection({
  fields: ["$.data.order.status", "data.order.id"],
});
assert.equal(proj.ok, true);
const projected = projectResponseValue(
  { data: { order: { id: "9", status: "shipped", secret: "x" } } },
  proj.projection
);
assert.equal(projected.ok, true);
assert.equal(projected.value.data.order.status, "shipped");
console.log("ok  response projection $.paths");

// Pagination
const pageCfg = validatePaginationConfig({
  type: "CURSOR",
  nextCursorPath: "next",
  maxPages: 9,
});
assert.equal(pageCfg.ok, true);
assert.equal(pageCfg.pagination.maxPages, 2);
const step1 = nextPaginationStep({
  pagination: pageCfg.pagination,
  bodyText: JSON.stringify({ next: "abc" }),
  pageIndex: 0,
  args: {},
});
assert.equal(step1.done, false);
const stepRepeat = nextPaginationStep({
  pagination: pageCfg.pagination,
  bodyText: JSON.stringify({ next: "abc" }),
  pageIndex: 0,
  previousCursor: "abc",
  args: {},
});
assert.equal(stepRepeat.done, true);
assert.equal(stepRepeat.reason, "repeated_cursor");
const stepMax = nextPaginationStep({
  pagination: pageCfg.pagination,
  bodyText: JSON.stringify({ next: "xyz" }),
  pageIndex: 1,
  args: {},
});
assert.equal(stepMax.done, true);
assert.equal(stepMax.reason, "max_pages");
console.log("ok  bounded pagination");

// Envelope
const envOk = toExecutionEnvelope({
  ok: true,
  status: "OK",
  bodyText: '{"a":1}',
  truncated: false,
});
assert.equal(envOk.ok, true);
assert.deepEqual(envOk.data, { a: 1 });
const envFail = toExecutionEnvelope({
  ok: false,
  status: "TIMEOUT",
  errorCode: "TIMEOUT",
});
assert.equal(envFail.ok, false);
assert.equal(envFail.error.code, "UPSTREAM_TIMEOUT");
console.log("ok  execution envelope");

// Pin address picker rejects private
assert.equal(isPrivateOrMetadataAddress("127.0.0.1"), true);
assert.equal(pickPinnedAddress(["10.0.0.1", "8.8.8.8"]), "8.8.8.8");
assert.equal(pickPinnedAddress(["127.0.0.1", "10.0.0.1"]), null);
console.log("ok  pinned address selection");

// MCP proven public READ (AIDE-GAP-010) — classification helper mirror
function mcpProvenPublicRead(action) {
  const riskUpper = String(action.riskLevel || "READ").toUpperCase();
  const accessUpper = String(action.accessClass || "").trim().toUpperCase();
  return (
    Boolean(action._mcp) &&
    riskUpper === "READ" &&
    !Boolean(action.requiresConfirmation) &&
    (accessUpper === "PUBLIC_READ" || accessUpper === "GUEST_LOOKUP")
  );
}
assert.equal(
  mcpProvenPublicRead({
    _mcp: true,
    riskLevel: "READ",
    requiresConfirmation: false,
    accessClass: "PUBLIC_READ",
  }),
  true
);
assert.equal(
  mcpProvenPublicRead({
    _mcp: true,
    riskLevel: "READ",
    requiresConfirmation: false,
    accessClass: "ACCOUNT_READ",
  }),
  false,
  "mislabeled account read must not auto-run on embed"
);
assert.equal(
  mcpProvenPublicRead({
    _mcp: true,
    riskLevel: "WRITE",
    requiresConfirmation: false,
    accessClass: "PUBLIC_READ",
  }),
  false
);
console.log("ok  MCP proven READ classification");

console.log("\nGAP protocol adapter suite passed");
