"use client";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

/** Dev-only. Never mount in production builds. */
export function QueryDevtools() {
  if (process.env.NODE_ENV !== "development") return null;
  return <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />;
}
