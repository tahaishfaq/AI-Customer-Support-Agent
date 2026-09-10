import assert from "node:assert/strict";
import http from "node:http";
import { executeHttpAction, resolveRequestBody, serializeFormUrlEncoded } from "../lib/actions/http-executor.js";
import { validateToolArgs } from "../lib/actions/tool-definitions.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const typedTemplate = {
  title: "{{title}}",
  count: "{{count}}",
  enabled: "{{enabled}}",
  tags: "{{tags}}",
  nullable: "{{nullable}}",
  optional: "{{optional}}",
};
const typed = resolveRequestBody(typedTemplate, {
  title: "AIDE",
  count: 3,
  enabled: false,
  tags: ["a", "b"],
  nullable: null,
});
assert.deepEqual(typed, {
  title: "AIDE",
  count: 3,
  enabled: false,
  tags: ["a", "b"],
  nullable: null,
});
assert.equal(serializeFormUrlEncoded(typed), "title=AIDE&count=3&enabled=false&tags=a&tags=b&nullable=null");

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    count: { type: "integer" },
  },
  required: ["title"],
};
assert.deepEqual(validateToolArgs(schema, { title: "ok" }), {
  ok: true,
  args: { title: "ok" },
});
assert.equal(validateToolArgs(schema, { title: "ok", extra: true }).ok, false);
assert.equal(validateToolArgs(schema, { title: "ok", count: 1.2 }).ok, false);

let requests = 0;
let lastRequest = null;
const server = http.createServer((request, response) => {
  requests += 1;
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    lastRequest = { headers: request.headers, body };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

try {
  const jsonResult = await executeHttpAction({
    method: "POST",
    urlTemplate: `http://127.0.0.1:${port}/capture/{{id}}`,
    requestContentType: "application/json",
    requestBodyTemplate: { title: "{{title}}", count: "{{count}}" },
    args: { id: "a/b", title: "typed", count: 7 },
    allowLocalDemo: true,
    retryOnce: false,
  });
  assert.equal(jsonResult.ok, true);
  assert.deepEqual(JSON.parse(lastRequest.body), { title: "typed", count: 7 });
  assert.equal(lastRequest.headers["content-type"], "application/json");
  assert.equal(new URL(`http://127.0.0.1:${port}/capture/a%2Fb`).pathname, "/capture/a%2Fb");

  const formResult = await executeHttpAction({
    method: "POST",
    urlTemplate: `http://127.0.0.1:${port}/form`,
    requestContentType: "application/x-www-form-urlencoded",
    requestBodyTemplate: { title: "{{title}}", tags: "{{tags}}" },
    args: { title: "AIDE support", tags: ["one", "two"] },
    allowLocalDemo: true,
    retryOnce: false,
  });
  assert.equal(formResult.ok, true);
  assert.equal(lastRequest.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(lastRequest.body, "title=AIDE+support&tags=one&tags=two");

  const beforeInvalid = requests;
  const invalidResult = await executeHttpAction({
    method: "POST",
    urlTemplate: `http://127.0.0.1:${port}/invalid`,
    requestBodyTemplate: { message: "prefix {{missing}}" },
    args: {},
    allowLocalDemo: true,
    retryOnce: false,
  });
  assert.equal(invalidResult.errorCode, "SCHEMA_INVALID");
  assert.equal(requests, beforeInvalid);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const schemaSource = await readFile(
  path.join(root, "lib/validations/actions.js"),
  "utf8"
);
assert.match(schemaSource, /requestBodyTemplate/);
assert.match(schemaSource, /requestContentType/);

console.log("HTTP tools Phase 2 contract and executor checks passed");
