import assert from "node:assert/strict";
import http from "node:http";
import { executeHttpAction } from "../lib/actions/http-executor.js";
import {
  normalizeProjectedResponse,
  validateResponseProjection,
} from "../lib/actions/response-projection.js";

const server = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/mismatch") {
    response.setHeader("Content-Type", "text/plain");
    response.end('{"status":"ok"}');
    return;
  }
  if (request.url === "/invalid-type") {
    response.end(JSON.stringify({ status: 42 }));
    return;
  }
  if (request.url === "/empty") {
    response.end("[]");
    return;
  }
  if (request.url === "/large") {
    response.end("x".repeat(9000));
    return;
  }
  response.end(JSON.stringify({
    id: "ORD-1",
    status: "Shipped",
    customer: { email: "person@example.com" },
    token: "secret-token",
    internalNote: "do not expose",
  }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const url = (path) => `http://127.0.0.1:${port}${path}`;

try {
  assert.equal(validateResponseProjection({ fields: ["status", "customer"] }).ok, true);
  assert.equal(validateResponseProjection({ fields: ["token"] }).ok, false);
  assert.equal(validateResponseProjection({ fields: ["customer.email"] }).ok, false);

  const projected = normalizeProjectedResponse(
    JSON.stringify({ status: "Shipped", ignored: true }),
    { fields: ["status"] }
  );
  assert.deepEqual(projected.value, { status: "Shipped" });

  const result = await executeHttpAction({
    urlTemplate: url("/ok"),
    allowLocalDemo: true,
    retryOnce: false,
    responseProjectionJson: { fields: ["id", "status", "customer"] },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(result.bodyText), {
    id: "ORD-1",
    status: "Shipped",
    customer: { email: "[redacted]" },
  });
  assert.equal(JSON.parse(result.bodyText).internalNote, undefined);
  assert.equal(JSON.parse(result.bodyText).token, undefined);

  const mismatch = await executeHttpAction({
    urlTemplate: url("/mismatch"),
    allowLocalDemo: true,
    retryOnce: false,
    responseProjectionJson: { fields: ["status"] },
  });
  assert.equal(mismatch.errorCode, "CONTENT_TYPE_INVALID");

  const invalidType = await executeHttpAction({
    urlTemplate: url("/invalid-type"),
    allowLocalDemo: true,
    retryOnce: false,
    outputSchemaJson: { status: "string" },
  });
  assert.equal(invalidType.errorCode, "OUTPUT_SCHEMA_INVALID");

  const empty = await executeHttpAction({
    urlTemplate: url("/empty"),
    allowLocalDemo: true,
    retryOnce: false,
    responseProjectionJson: { fields: ["status"] },
  });
  assert.equal(empty.ok, true);
  assert.equal(empty.status, "NO_RESULT");

  const large = await executeHttpAction({
    urlTemplate: url("/large"),
    allowLocalDemo: true,
    retryOnce: false,
  });
  assert.equal(large.truncated, true);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("HTTP tools Phase 5 projection and response-safety checks passed");
