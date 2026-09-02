/**
 * Resolve or create a request id for correlating API responses with server logs.
 * Prefer client/edge `x-request-id` when present; otherwise generate UUID.
 */
export function resolveRequestId(request) {
  const incoming = request?.headers?.get?.("x-request-id")?.trim();
  if (incoming && incoming.length <= 128 && /^[\w.:\-]+$/.test(incoming)) {
    return incoming;
  }
  return crypto.randomUUID();
}

export function requestIdHeaders(requestId) {
  return { "x-request-id": requestId };
}
