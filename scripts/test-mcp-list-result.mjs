/**
 * Large MCP list results: parse, compact, model text budget, chunked paging caps.
 * Run: node --test scripts/test-mcp-list-result.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIST_MAX_ITEMS,
  collectPagedList,
  compactItem,
  formatCompactListForModel,
  listTitleFor,
  paginationParams,
  parseListPayload,
  wantsFullList,
} from "../lib/mcp/list-result.js";

const repo = (i) => ({
  id: i,
  name: `repo-${i}`,
  full_name: `sami/repo-${i}`,
  description: `Repository number ${i} with a fairly long description`.repeat(2),
  html_url: `https://github.com/sami/repo-${i}`,
  url: `https://api.github.com/repos/sami/repo-${i}`,
  language: "JavaScript",
  stargazers_count: i,
  private: i % 2 === 0,
  pushed_at: "2026-09-20T10:00:00Z",
  owner: { login: "sami", avatar_url: "https://x", events_url: "https://y", repos_url: "https://z" },
});

/** Fake paged API: `count` items, 100 per page. */
function fakeApi(count) {
  const calls = [];
  const page = (n) => {
    calls.push(n);
    const items = Array.from({ length: Math.max(0, Math.min(100, count - (n - 1) * 100)) }, (_, k) => repo((n - 1) * 100 + k + 1));
    return JSON.stringify({ total_count: count, items });
  };
  return { calls, page };
}

test("parses bare arrays and wrapper keys; rejects non-lists", () => {
  assert.equal(parseListPayload(JSON.stringify([repo(1), repo(2)])).items.length, 2);
  const wrapped = parseListPayload(JSON.stringify({ total_count: 42, items: [repo(1)] }));
  assert.equal(wrapped.total, 42);
  assert.equal(wrapped.items.length, 1);
  assert.equal(parseListPayload('{"ok":true}'), null);
  assert.equal(parseListPayload("not json"), null);
  assert.equal(parseListPayload("[1,2,3]"), null, "arrays of scalars are not item lists");
  assert.equal(parseListPayload("[]"), null);
});

test("compactItem keeps readable fields, drops API noise and non-https links", () => {
  const item = compactItem(repo(3));
  assert.deepEqual(Object.keys(item).sort(), ["description", "language", "stars", "title", "updated", "url", "visibility"]);
  assert.equal(item.title, "sami/repo-3");
  assert.equal(item.url, "https://github.com/sami/repo-3");
  assert.equal(item.updated, "2026-09-20");
  assert.equal(compactItem({ name: "x", html_url: "javascript:alert(1)" }).url, undefined);
  assert.ok(compactItem({ name: "x", description: "d".repeat(500) }).description.length <= 140);
});

test("model text stays within budget and points to the list card", () => {
  const items = Array.from({ length: 237 }, (_, i) => compactItem(repo(i + 1)));
  const text = formatCompactListForModel(items, { total: 237, maxChars: 3600 });
  assert.ok(text.length <= 3700, `length ${text.length}`);
  assert.match(text, /^LIST RESULT: 237 item\(s\)/);
  assert.match(text, /more in the list card/);
  assert.ok((text.match(/^- /gm) || []).length >= 15, "dozens of items, not ~4");
});

test("chunked fetching: 237 items → 3 pages, complete, progress per page", async () => {
  const api = fakeApi(237);
  const progress = [];
  const result = await collectPagedList({
    first: parseListPayload(api.page(1)),
    paginate: true,
    fetchPage: async (n) => api.page(n),
    onProgress: (p) => progress.push(p.items.length),
  });
  assert.equal(result.items.length, 237);
  assert.equal(result.fetchedAll, true);
  assert.deepEqual(api.calls, [1, 2, 3]);
  assert.deepEqual(progress, [100, 100, 37]);
});

test("chunked fetching caps at 500 items and reports it", async () => {
  const api = fakeApi(700);
  const result = await collectPagedList({ first: parseListPayload(api.page(1)), paginate: true, fetchPage: async (n) => api.page(n) });
  assert.equal(result.items.length, LIST_MAX_ITEMS);
  assert.equal(result.fetchedAll, false);
  assert.deepEqual(api.calls, [1, 2, 3, 4, 5]);
});

test("time budget, page errors and paginate=false all stop paging", async () => {
  const api = fakeApi(400);
  let clock = 0;
  const timed = await collectPagedList({
    first: parseListPayload(api.page(1)),
    paginate: true,
    startedAt: 0,
    budgetMs: 1000,
    now: () => clock,
    fetchPage: async (n) => {
      clock += 800;
      return api.page(n);
    },
  });
  // Checked before each page: pages starting at 0 ms and 800 ms run; at 1600 ms paging stops.
  assert.equal(timed.items.length, 300, "no page starts after the budget");
  assert.equal(timed.fetchedAll, false);

  const failing = await collectPagedList({
    first: parseListPayload(fakeApi(400).page(1)),
    paginate: true,
    fetchPage: async () => {
      throw new Error("MCP 500");
    },
  });
  assert.equal(failing.items.length, 100);
  assert.equal(failing.fetchedAll, false);

  const single = fakeApi(400);
  const once = await collectPagedList({ first: parseListPayload(single.page(1)), paginate: false, fetchPage: async (n) => single.page(n) });
  assert.equal(once.items.length, 100);
  assert.deepEqual(single.calls, [1]);
});

test("helpers: wants-all detection, pagination params, titles", () => {
  assert.equal(wantsFullList("fetch all my repositories"), true);
  assert.equal(wantsFullList("show my repos"), false);
  assert.deepEqual(paginationParams({ properties: { query: {}, page: {}, perPage: {} } }), { pageKey: "page", sizeKey: "perPage" });
  assert.equal(paginationParams({ properties: { query: {} } }), null);
  assert.equal(listTitleFor("search_repositories"), "Repositories");
  assert.equal(listTitleFor("mcp_github_mcp_list_issues"), "Issues");
});
