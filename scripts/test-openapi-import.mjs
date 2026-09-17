/**
 * Task 9 — OpenAPI → disabled draft AgentActions (publish + policy review required).
 * Run: npm run test:openapi-import
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOpenApiActionDrafts,
  openApiPathToUrlTemplate,
  parseOpenApiDocument,
  planOpenApiImport,
} from "../lib/integrations/openapi/parse-openapi.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const SAMPLE = {
  openapi: "3.0.3",
  info: { title: "Orders API", version: "1.0.0" },
  servers: [{ url: "https://api.merchant.example" }],
  paths: {
    "/orders/{orderId}": {
      get: {
        operationId: "getOrder",
        summary: "Get order by id",
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "ok" } },
      },
      delete: {
        operationId: "deleteOrder",
        summary: "Delete order",
        responses: { "204": { description: "gone" } },
      },
    },
    "/tickets": {
      post: {
        operationId: "createTicket",
        summary: "Create support ticket",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subject"],
                properties: {
                  subject: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "created" } },
      },
    },
  },
};

function testParseAndPathTemplate() {
  assert.equal(
    openApiPathToUrlTemplate("/orders/{orderId}"),
    "/orders/{{orderId}}"
  );
  assert.throws(() => parseOpenApiDocument({ swagger: "2.0", paths: {} }), /Swagger/);
  assert.throws(() => parseOpenApiDocument({ openapi: "2.0", paths: {} }), /3\.x/);
  console.log("ok  parse guards + path template");
}

function testDraftsDisabledAndConservative() {
  const plan = planOpenApiImport(SAMPLE);
  assert.equal(plan.meta.needsPublish, true);
  assert.equal(plan.meta.needsPolicyReview, true);
  assert.equal(plan.drafts.length, 2);
  assert.ok(plan.skipped.some((s) => s.reason === "METHOD_UNSUPPORTED"));

  const getOrder = plan.drafts.find((d) => d.name === "get_order");
  assert.ok(getOrder);
  assert.equal(getOrder.enabled, false);
  assert.equal(getOrder.needsPublish, true);
  assert.equal(getOrder.needsPolicyReview, true);
  assert.equal(getOrder.method, "GET");
  assert.equal(
    getOrder.urlTemplate,
    "https://api.merchant.example/orders/{{orderId}}"
  );
  assert.equal(getOrder.accessClass, "ACCOUNT_READ");
  assert.equal(getOrder.requiresIdentity, true);
  assert.equal(getOrder.requiresConfirmation, true);

  const create = plan.drafts.find((d) => d.name === "create_ticket");
  assert.ok(create);
  assert.equal(create.enabled, false);
  assert.equal(create.method, "POST");
  assert.equal(create.accessClass, "ACCOUNT_WRITE");
  assert.equal(create.requiresConfirmation, true);
  assert.ok(create.inputSchemaJson?.properties?.subject);
  console.log("ok  disabled drafts with conservative policy");
}

function testBaseUrlRequiredAndSkipExisting() {
  const noServers = {
    openapi: "3.1.0",
    info: { title: "x", version: "1" },
    paths: {
      "/ping": {
        get: { operationId: "ping", responses: { "200": { description: "ok" } } },
      },
    },
  };
  assert.throws(() => buildOpenApiActionDrafts(noServers), /base URL/i);
  const withBase = buildOpenApiActionDrafts(noServers, {
    baseUrl: "https://example.com",
  });
  assert.equal(withBase.drafts[0].urlTemplate, "https://example.com/ping");

  const skippedExisting = planOpenApiImport(SAMPLE, {
    existingNames: ["get_order"],
  });
  assert.ok(skippedExisting.drafts.every((d) => d.name !== "get_order"));
  assert.ok(skippedExisting.drafts.some((d) => d.name === "get_order_2" || d.name === "create_ticket"));
  console.log("ok  baseUrl + existing name uniquify");
}

function testWiring() {
  const importer = read("lib/integrations/openapi/import-openapi.js");
  assert.match(importer, /enabled:\s*false/);
  assert.match(importer, /state:\s*"DRAFT"/);
  assert.match(importer, /needsPublish:\s*true/);
  assert.match(importer, /needsPolicyReview:\s*true/);
  assert.doesNotMatch(importer, /state:\s*"PUBLISHED"/);
  assert.doesNotMatch(importer, /publishedRevisionId:/);

  const route = read(
    "app/api/agents/[id]/actions/openapi-import/route.js"
  );
  assert.match(route, /importOpenApiActionsForAgent/);
  assert.match(route, /never publishes or enables/i);

  const publish = read("lib/services/action-revision.service.js");
  assert.match(publish, /Disabled revision cannot be published/);

  const api = read("lib/api/actions.js");
  assert.match(api, /openapi-import/);
  console.log("ok  import wiring stays draft-only");
}

testParseAndPathTemplate();
testDraftsDisabledAndConservative();
testBaseUrlRequiredAndSkipExisting();
testWiring();
console.log("openapi-import: ok");
