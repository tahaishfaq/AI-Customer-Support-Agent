import { NextResponse } from "next/server";
import {
  resolveRequestId,
  requestIdHeaders,
} from "@/lib/observability/request-id";

/**
 * Standard API error: `{ error: { message, details } }` + `x-request-id`.
 */
export function jsonError(
  request,
  status,
  message,
  details = {},
  extraHeaders = {}
) {
  const requestId = resolveRequestId(request);
  return NextResponse.json(
    { error: { message, details } },
    {
      status,
      headers: {
        ...requestIdHeaders(requestId),
        ...extraHeaders,
      },
    }
  );
}

/**
 * JSON success response with `x-request-id`.
 */
export function jsonOk(request, data, status = 200, extraHeaders = {}) {
  const requestId = resolveRequestId(request);
  return NextResponse.json(data, {
    status,
    headers: {
      ...requestIdHeaders(requestId),
      ...extraHeaders,
    },
  });
}

/**
 * Attach `x-request-id` to an existing NextResponse (e.g. from requireAuth).
 */
export function withRequestId(request, response) {
  const requestId = resolveRequestId(request);
  response.headers.set("x-request-id", requestId);
  return response;
}
