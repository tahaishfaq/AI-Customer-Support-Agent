/**
 * Task 4 — Shopify Admin connector wraps http-executor; token never reaches the model.
 * Run: npm run test:shopify-connector
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatToolResultForModel } from "../lib/actions/tool-errors.js";
import { applyCredentialToHeaders } from "../lib/actions/credential-apply.js";
import {
  ACTION_CONNECTOR_BY_NAME,
  CONNECTOR_IDS,
  SHOPIFY_ACCESS_TOKEN_HEADER,
  buildShopifyGetOrderRequest,
  canUseShopifyAdminConnector,
  executeShopifyGetOrder,
  isShopifyAdminHostname,
  normalizeShopifyShopOrigin,
  projectShopifyOrderForModel,
  resolveConnectorId,
  resolveShopifyShopOriginFromContext,
  scrubSecretsFromResult,
  tryExecuteManagedConnector,
} from "../lib/integrations/connectors/index.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECRET = "shpat_test_secret_token_do_not_leak_12345";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testHostGuards() {
  assert.equal(isShopifyAdminHostname("acme.myshopify.com"), true);
  assert.equal(isShopifyAdminHostname("evil.com"), false);
  assert.equal(isShopifyAdminHostname("myshopify.com"), false);
  assert.equal(
    normalizeShopifyShopOrigin("acme.myshopify.com"),
    "https://acme.myshopify.com"
  );
  assert.equal(normalizeShopifyShopOrigin("acme"), "https://acme.myshopify.com");
  assert.throws(() => normalizeShopifyShopOrigin("https://api.example.com"), /myshopify/);
  console.log("ok  shop host guards");
}

function testRequestBuilder() {
  const req = buildShopifyGetOrderRequest({
    shopOrigin: "https://acme.myshopify.com",
    orderId: "5678901234",
  });
  assert.equal(req.method, "GET");
  assert.equal(
    req.urlTemplate,
    "https://acme.myshopify.com/admin/api/2024-10/orders/{{orderId}}.json"
  );
  assert.equal(req.frozenHost, "acme.myshopify.com");
  assert.equal(req.args.orderId, "5678901234");
  assert.doesNotMatch(JSON.stringify(req), new RegExp(SECRET));
  assert.throws(
    () =>
      buildShopifyGetOrderRequest({
        shopOrigin: "https://acme.myshopify.com",
        orderId: "../admin",
      }),
    /orderId/
  );
  console.log("ok  Admin order request builder");
}

function testCredentialHeader() {
  const headers = applyCredentialToHeaders(
    { Accept: "application/json" },
    {
      type: "API_KEY_HEADER",
      headerName: SHOPIFY_ACCESS_TOKEN_HEADER,
      plaintext: SECRET,
    }
  );
  assert.equal(headers[SHOPIFY_ACCESS_TOKEN_HEADER], SECRET);
  assert.equal(headers.Authorization, undefined);
  console.log("ok  X-Shopify-Access-Token via credential (not Bearer)");
}

async function testSandboxFetchScrubsToken() {
  let captured = null;
  const fakeExecute = async (opts) => {
    captured = opts;
    const headers = applyCredentialToHeaders(
      opts.headersJson || {},
      opts.credential
    );
    assert.equal(headers[SHOPIFY_ACCESS_TOKEN_HEADER], SECRET);
    return {
      ok: true,
      status: "OK",
      httpStatus: 200,
      durationMs: 12,
      errorCode: null,
      bodyText: JSON.stringify({
        order: {
          id: 5678901234,
          name: "#1001",
          email: "buyer@example.com",
          financial_status: "paid",
          fulfillment_status: "fulfilled",
          total_price: "42.00",
          currency: "USD",
          created_at: "2026-01-02T00:00:00Z",
          line_items: [{ title: "Tee", quantity: 1, sku: "TEE-1" }],
          note: `leak ${SECRET}`,
        },
      }),
      truncated: false,
      retried: false,
    };
  };

  const result = await executeShopifyGetOrder({
    orderId: "5678901234",
    shopOrigin: "https://acme.myshopify.com",
    credential: { plaintext: SECRET, name: "shopify_admin" },
    executeHttpAction: fakeExecute,
  });

  assert.equal(result.ok, true);
  assert.equal(
    captured.urlTemplate,
    "https://acme.myshopify.com/admin/api/2024-10/orders/{{orderId}}.json"
  );
  assert.equal(captured.credential.headerName, SHOPIFY_ACCESS_TOKEN_HEADER);
  assert.doesNotMatch(result.bodyText, new RegExp(SECRET));
  assert.match(result.bodyText, /#1001/);
  assert.doesNotMatch(result.bodyText, /buyer@example\.com/);

  const forModel = formatToolResultForModel(result, {
    actionName: "shopify_get_order",
    guest: false,
  });
  assert.doesNotMatch(forModel, new RegExp(SECRET));
  assert.match(forModel, /#1001/);
  console.log("ok  sandbox fetch; token scrubbed from model payload");
}

function testRoutingGates() {
  assert.equal(resolveConnectorId({ name: "shopify_get_order" }), CONNECTOR_IDS.SHOPIFY_ADMIN);
  assert.equal(ACTION_CONNECTOR_BY_NAME.shopify_get_order, CONNECTOR_IDS.SHOPIFY_ADMIN);
  assert.equal(
    canUseShopifyAdminConnector({
      action: {
        name: "shopify_get_order",
        urlTemplate: "https://api.example.com/shopify/orders/{{orderId}}.json",
      },
      connection: null,
      credential: { plaintext: SECRET },
    }),
    false,
    "example.com template alone is not live connector"
  );
  assert.equal(
    canUseShopifyAdminConnector({
      action: {
        name: "shopify_get_order",
        urlTemplate: "https://api.example.com/shopify/orders/{{orderId}}.json",
      },
      connection: {
        revision: { baseOrigin: "https://acme.myshopify.com" },
      },
      credential: { plaintext: SECRET },
    }),
    true
  );
  assert.equal(
    resolveShopifyShopOriginFromContext({
      connection: { revision: { baseOrigin: "https://acme.myshopify.com" } },
      action: {
        urlTemplate: "https://api.example.com/shopify/orders/{{orderId}}.json",
      },
    }),
    "https://acme.myshopify.com"
  );
  console.log("ok  connector routing gates");
}

async function testTryExecuteFallthrough() {
  const miss = await tryExecuteManagedConnector({
    action: {
      name: "shopify_get_order",
      urlTemplate: "https://api.example.com/shopify/orders/{{orderId}}.json",
    },
    args: { orderId: "1" },
    credential: { plaintext: SECRET },
    connection: null,
    executeHttpAction: async () => {
      throw new Error("should not run");
    },
  });
  assert.equal(miss.handled, false);

  const hit = await tryExecuteManagedConnector({
    action: {
      name: "shopify_get_order",
      urlTemplate: "https://api.example.com/shopify/orders/{{orderId}}.json",
    },
    args: { orderId: "1001" },
    credential: { plaintext: SECRET },
    connection: {
      revision: { baseOrigin: "https://acme.myshopify.com" },
    },
    executeHttpAction: async () => ({
      ok: true,
      status: "OK",
      httpStatus: 200,
      durationMs: 1,
      errorCode: null,
      bodyText: JSON.stringify({
        order: { id: 1001, name: "#1001", financial_status: "paid" },
      }),
      truncated: false,
      retried: false,
    }),
  });
  assert.equal(hit.handled, true);
  assert.equal(hit.connectorId, CONNECTOR_IDS.SHOPIFY_ADMIN);
  assert.doesNotMatch(hit.result.bodyText, new RegExp(SECRET));
  console.log("ok  tryExecuteManagedConnector fallthrough + hit");
}

function testProjectionAndScrub() {
  const projected = projectShopifyOrderForModel(
    JSON.stringify({
      order: {
        id: 1,
        name: "#1",
        customer: { email: "a@b.c" },
        financial_status: "paid",
        line_items: [{ title: "A", quantity: 2 }],
      },
    })
  );
  const parsed = JSON.parse(projected);
  assert.equal(parsed.order.name, "#1");
  assert.equal(parsed.order.customer, undefined);
  const scrubbed = scrubSecretsFromResult(
    { ok: true, bodyText: `token=${SECRET}` },
    [SECRET]
  );
  assert.equal(scrubbed.bodyText, "token=[redacted-secret]");
  console.log("ok  projection + scrub helper");
}

function testWiring() {
  const invoke = read("lib/actions/invoke-tool.js");
  assert.match(invoke, /tryExecuteManagedConnector/);
  assert.match(invoke, /allowConnectorRewrite/);
  const conn = read("lib/services/connection.service.js");
  assert.match(conn, /allowConnectorRewrite/);
  console.log("ok  invoke + connection wiring");
}

async function main() {
  testHostGuards();
  testRequestBuilder();
  testCredentialHeader();
  await testSandboxFetchScrubsToken();
  testRoutingGates();
  await testTryExecuteFallthrough();
  testProjectionAndScrub();
  testWiring();
  console.log("\nshopify-connector smoke passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
