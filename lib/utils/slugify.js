/**
 * Turn a workspace name into a URL-safe slug.
 * "My Cool Workspace" → "my-cool-workspace"
 */
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "workspace";
}

/** First workspace label from the account — never "Default Workspace". */
export function defaultWorkspaceNameFromUser(user) {
  const fromName = String(user?.name || "").trim();
  if (fromName) return fromName.slice(0, 60);
  const local = String(user?.email || "").split("@")[0].trim();
  if (local) return local.slice(0, 60);
  return "Workspace";
}

