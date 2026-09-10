"use client";

/**
 * Extract the current workspace slug from the URL.
 * Proxy rewrites /ws/{slug}/... → /..., but the browser URL still shows /ws/{slug}/...
 */
export function useWorkspaceSlug() {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "ws" && parts[1]) return parts[1];
  return null;
}

export function workspaceInnerPath(pathname = "") {
  const parts = String(pathname).split("/").filter(Boolean);
  if (parts[0] !== "ws") return pathname || "/dashboard";
  const rest = parts.slice(2);
  return rest.length ? `/${rest.join("/")}` : "/dashboard";
}

export function hrefForWorkspaceSlug(slug, pathname, search = "") {
  const inner = workspaceInnerPath(pathname);
  const safe = String(slug || "").trim();
  if (!safe) return `${inner}${search}`;
  return `/ws/${safe}${inner.startsWith("/") ? inner : `/${inner}`}${search}`;
}

/**
 * Prefix a path with the current workspace slug.
 * "/agents/123" → "/ws/my-workspace/agents/123"
 */
export function useWsHref(path) {
  const slug = useWorkspaceSlug();
  if (!slug) return path;
  return `/ws/${slug}${path.startsWith("/") ? path : `/${path}`}`;
}
