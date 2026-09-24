/**
 * Large MCP list results (repositories, issues, pull requests…): compact each item to the
 * fields people read, so dozens fit where raw JSON fit ~4. Pure + display-only — list
 * contents stay untrusted DATA (fenced for the model, plain text in the UI).
 */

export const LIST_MAX_ITEMS = 500;
export const LIST_PAGE_SIZE = 100;
export const LIST_MAX_PAGES = 5;
/** Wall-clock budget for chunked fetching inside one tool step (loop deadline is 25 s). */
export const LIST_FETCH_BUDGET_MS = 18_000;

const ARRAY_KEYS = ["items", "repositories", "repos", "results", "data", "issues", "pull_requests", "nodes"];
const TOTAL_KEYS = ["total_count", "totalCount", "total"];
const clip = (value, max) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const httpsOrNull = (value) => (typeof value === "string" && /^https:\/\/\S+$/i.test(value) ? value.slice(0, 500) : null);

function parseJson(text) {
  const raw = String(text || "").trim();
  if (!raw || (raw[0] !== "[" && raw[0] !== "{")) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** { items, total } when the tool text is a JSON list (bare array or a common wrapper key). */
export function parseListPayload(text) {
  const json = parseJson(text);
  if (!json) return null;
  let items = null;
  if (Array.isArray(json)) items = json;
  else {
    for (const key of ARRAY_KEYS) {
      if (Array.isArray(json[key])) {
        items = json[key];
        break;
      }
    }
  }
  if (!items || !items.length || !items.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    return null;
  }
  let total = null;
  if (!Array.isArray(json)) {
    for (const key of TOTAL_KEYS) {
      if (Number.isFinite(json[key])) {
        total = json[key];
        break;
      }
    }
  }
  return { items, total };
}

/** The fields people scan in a list; everything else (owner objects, 30 API URLs) is dropped. */
export function compactItem(item) {
  const title = clip(item.full_name || item.name || item.title || item.login || item.key || item.id || "Item", 120);
  const out = { title };
  const description = item.description ?? item.body ?? null;
  if (description) out.description = clip(description, 140);
  const url = httpsOrNull(item.html_url) || httpsOrNull(item.url) || httpsOrNull(item.web_url);
  if (url) out.url = url;
  if (item.language) out.language = clip(item.language, 30);
  if (Number.isFinite(item.stargazers_count)) out.stars = item.stargazers_count;
  if (Number.isFinite(item.number)) out.number = item.number;
  if (item.state) out.state = clip(item.state, 20);
  if (typeof item.private === "boolean") out.visibility = item.private ? "private" : "public";
  const updated = item.pushed_at || item.updated_at || item.updatedAt;
  if (typeof updated === "string") out.updated = updated.slice(0, 10);
  return out;
}

function line(item) {
  const bits = [item.title];
  if (item.description) bits.push(`— ${item.description}`);
  const meta = [
    item.visibility,
    item.language,
    Number.isFinite(item.stars) ? `★${item.stars}` : null,
    item.state,
    item.updated ? `updated ${item.updated}` : null,
  ].filter(Boolean);
  if (meta.length) bits.push(`(${meta.join(", ")})`);
  if (item.url) bits.push(item.url);
  return `- ${bits.join(" ")}`;
}

/**
 * Model-facing text within `maxChars`. The full list goes to the chat UI, so the model is told
 * to summarize instead of re-typing every row.
 */
export function formatCompactListForModel(items, { total = null, maxChars = 3600, fetchedAll = true } = {}) {
  const count = items.length;
  const known = Number.isFinite(total) ? total : count;
  const header = `LIST RESULT: ${count} item(s)${known > count ? ` of ${known}` : ""}${fetchedAll ? "" : " (more exist; fetch limit reached)"}. The full list is shown to the user as a list card below your reply — summarize it (counts, highlights, what to look at), do not repeat every row.`;
  const lines = [header];
  let used = header.length;
  let shown = 0;
  for (const item of items) {
    const next = line(item);
    if (used + next.length + 1 > maxChars) break;
    lines.push(next);
    used += next.length + 1;
    shown += 1;
  }
  if (shown < count) lines.push(`…and ${count - shown} more in the list card.`);
  return lines.join("\n");
}

/** Tool accepts page + page-size arguments (GitHub MCP: page / perPage). */
export function paginationParams(inputSchema) {
  const props = inputSchema && typeof inputSchema === "object" ? inputSchema.properties || {} : {};
  const pageKey = ["page"].find((key) => key in props);
  const sizeKey = ["perPage", "per_page", "pageSize", "page_size", "limit"].find((key) => key in props);
  return pageKey && sizeKey ? { pageKey, sizeKey } : null;
}

/** Visitor asked for everything ("all my repos", "full list", "every issue"). */
export function wantsFullList(message) {
  return /\b(all|every|entire|complete|full)\b/i.test(String(message || ""));
}

/** "search_repositories" → "Repositories" for the list card header. */
export function listTitleFor(toolName) {
  const raw = String(toolName || "Results")
    .replace(/^mcp_[a-z0-9]+_[a-z0-9]+_/i, "")
    .replace(/^(search|list|get)_/i, "")
    .replace(/_/g, " ")
    .trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Results";
}

/**
 * Page through a list tool after its first page. `fetchPage(page)` returns the raw text of that
 * page (or null to stop). Sequential, bounded by LIST_MAX_ITEMS / LIST_MAX_PAGES / budget.
 * @returns {Promise<{ items: object[], total: number|null, fetchedAll: boolean }>}
 */
export async function collectPagedList({
  first,
  paginate,
  fetchPage,
  onProgress,
  startedAt = Date.now(),
  budgetMs = LIST_FETCH_BUDGET_MS,
  now = () => Date.now(),
}) {
  let items = first.items.map(compactItem);
  let lastPageSize = first.items.length;
  let complete = !paginate || lastPageSize < LIST_PAGE_SIZE;
  onProgress?.({ items, total: first.total, done: complete });
  for (let page = 2; paginate && !complete && page <= LIST_MAX_PAGES; page += 1) {
    if (items.length >= LIST_MAX_ITEMS || now() - startedAt > budgetMs) break;
    let text = null;
    try {
      text = await fetchPage(page);
    } catch {
      text = null;
    }
    const parsed = text == null ? null : parseListPayload(text);
    if (!parsed) break;
    const fresh = parsed.items.map(compactItem);
    items = [...items, ...fresh].slice(0, LIST_MAX_ITEMS);
    lastPageSize = parsed.items.length;
    complete = lastPageSize < LIST_PAGE_SIZE;
    onProgress?.({ items: fresh, total: first.total, done: complete });
  }
  if (!complete && paginate) onProgress?.({ items: [], total: first.total, done: true });
  return { items, total: first.total, fetchedAll: complete };
}
