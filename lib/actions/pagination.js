/**
 * Bounded HTTP pagination helper (AIDE-GAP-011).
 * maxPages default 1, hard max 2. Never unbounded crawl.
 */

export const PAGINATION_TYPES = Object.freeze([
  "NONE",
  "CURSOR",
  "PAGE",
  "OFFSET",
]);

export const PAGINATION_MAX_PAGES_HARD = 2;
export const PAGINATION_MAX_PAGES_DEFAULT = 1;

/**
 * @param {unknown} raw
 * @returns {{ ok: true, pagination: object|null } | { ok: false, error: string }}
 */
export function validatePaginationConfig(raw) {
  if (raw == null) return { ok: true, pagination: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "paginationJson must be an object" };
  }
  const type = String(raw.type || "NONE").toUpperCase();
  if (!PAGINATION_TYPES.includes(type)) {
    return { ok: false, error: `pagination type must be ${PAGINATION_TYPES.join("|")}` };
  }
  if (type === "NONE") return { ok: true, pagination: { type: "NONE", maxPages: 1 } };

  let maxPages = Number(raw.maxPages);
  if (!Number.isFinite(maxPages) || maxPages < 1) {
    maxPages = PAGINATION_MAX_PAGES_DEFAULT;
  }
  maxPages = Math.min(Math.floor(maxPages), PAGINATION_MAX_PAGES_HARD);

  const out = {
    type,
    maxPages,
    cursorPath: raw.cursorPath ? String(raw.cursorPath).trim() : null,
    nextCursorPath: raw.nextCursorPath ? String(raw.nextCursorPath).trim() : null,
    requestCursorParameter: raw.requestCursorParameter
      ? String(raw.requestCursorParameter).trim()
      : "cursor",
    pageParameter: raw.pageParameter ? String(raw.pageParameter).trim() : "page",
    offsetParameter: raw.offsetParameter
      ? String(raw.offsetParameter).trim()
      : "offset",
    limitParameter: raw.limitParameter ? String(raw.limitParameter).trim() : "limit",
    limit: Number.isFinite(Number(raw.limit))
      ? Math.min(Math.max(Math.floor(Number(raw.limit)), 1), 100)
      : 20,
  };
  return { ok: true, pagination: out };
}

function getPath(value, path) {
  if (!path) return undefined;
  return String(path)
    .replace(/^\$\./, "")
    .split(".")
    .reduce((cur, key) => (cur == null ? undefined : cur[key]), value);
}

/**
 * Extract next page args mutation from a JSON body text.
 * @returns {{ done: boolean, nextArgs?: Record<string, unknown>, reason?: string }}
 */
export function nextPaginationStep({
  pagination,
  bodyText,
  pageIndex,
  previousCursor = null,
  args = {},
}) {
  if (!pagination || pagination.type === "NONE") {
    return { done: true, reason: "none" };
  }
  if (pageIndex + 1 >= pagination.maxPages) {
    return { done: true, reason: "max_pages" };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(String(bodyText || ""));
  } catch {
    return { done: true, reason: "non_json" };
  }

  if (pagination.type === "CURSOR") {
    const next =
      getPath(parsed, pagination.nextCursorPath || pagination.cursorPath) ??
      getPath(parsed, "nextCursor") ??
      getPath(parsed, "cursor");
    if (next == null || next === "") {
      return { done: true, reason: "no_cursor" };
    }
    const cursor = String(next);
    if (previousCursor != null && cursor === String(previousCursor)) {
      return { done: true, reason: "repeated_cursor" };
    }
    return {
      done: false,
      nextArgs: {
        ...args,
        [pagination.requestCursorParameter]: cursor,
      },
      cursor,
    };
  }

  if (pagination.type === "PAGE") {
    const current = Number(args[pagination.pageParameter] || 1);
    return {
      done: false,
      nextArgs: {
        ...args,
        [pagination.pageParameter]: current + 1,
        [pagination.limitParameter]: pagination.limit,
      },
    };
  }

  if (pagination.type === "OFFSET") {
    const current = Number(args[pagination.offsetParameter] || 0);
    return {
      done: false,
      nextArgs: {
        ...args,
        [pagination.offsetParameter]: current + pagination.limit,
        [pagination.limitParameter]: pagination.limit,
      },
    };
  }

  return { done: true, reason: "unknown" };
}
