/** Edge-safe workspace URL helpers (used by proxy + app routing). */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function usableWorkspaceSlug(value) {
  const slug = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return SLUG_RE.test(slug) ? slug : null;
}

export function sanitizeWorkspaceSlug(value) {
  return usableWorkspaceSlug(value) || "workspace";
}

/**
 * /ws/acme/dashboard → { slug: "acme", inner: "/dashboard" }
 * /dashboard → null
 */
export function parseWorkspacePath(pathname) {
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean);
  if (parts[0] !== "ws" || !parts[1]) return null;
  const slug = sanitizeWorkspaceSlug(parts[1]);
  const rest = parts.slice(2);
  const inner = rest.length ? `/${rest.join("/")}` : "/dashboard";
  return { slug, inner };
}

export function stripWorkspacePrefix(pathname) {
  const parsed = parseWorkspacePath(pathname);
  return parsed ? parsed.inner : pathname;
}

export function withWorkspaceSlug(pathname, slug) {
  const inner = stripWorkspacePrefix(pathname) || "/dashboard";
  const safe = sanitizeWorkspaceSlug(slug);
  return `/ws/${safe}${inner.startsWith("/") ? inner : `/${inner}`}`;
}
