/**
 * Resolve TEST_BASE_URL for HTTP smoke scripts.
 * Rejects pasted "url || url" docs typos and validates http(s).
 */
export function resolveTestBaseUrl(raw = process.env.TEST_BASE_URL) {
  let value = String(raw || "http://127.0.0.1:3000").trim();
  // Common paste mistake: "http://localhost:3000 || http://127.0.0.1:3000"
  if (/\s*\|\|\s*/.test(value)) {
    value = value.split(/\s*\|\|\s*/)[0].trim();
  }
  value = value.replace(/\/$/, "");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `Invalid TEST_BASE_URL=${JSON.stringify(raw)}. Use a single URL like http://127.0.0.1:3000`
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `TEST_BASE_URL must be http(s), got ${parsed.protocol} (${value})`
    );
  }
  return value;
}
