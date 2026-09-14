function policyError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw policyError("Connection base origin must be a valid URL");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalHost(url.hostname))) {
    throw policyError("Connection base origin must use HTTPS");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw policyError("Connection base origin must contain only scheme, host, and port");
  }
  return url.origin;
}

export function actionOrigin(urlTemplate) {
  try {
    const url = new URL(String(urlTemplate || "").replace(/\{\{[^}]+\}\}/g, "placeholder"));
    return url.origin;
  } catch {
    return null;
  }
}

export function isActionDestinationAllowed(urlTemplate, revision) {
  const origin = actionOrigin(urlTemplate);
  if (!origin || !revision) return false;
  const allowed = Array.isArray(revision.allowedDestinations)
    ? revision.allowedDestinations
    : [revision.baseOrigin];
  return allowed.includes(origin);
}
