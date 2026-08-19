"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Keep a nested studio panel in the URL so refresh stays on the same tab.
 */
export function useUrlTab(key, allowed, fallback) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get(key);
  const value = allowed.includes(raw) ? raw : fallback;

  const setValue = useCallback(
    (next) => {
      if (!allowed.includes(next) || next === value) return;
      const params = new URLSearchParams(searchParams.toString());
      if (next === fallback) params.delete(key);
      else params.set(key, next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [allowed, fallback, key, pathname, router, searchParams, value]
  );

  return [value, setValue];
}
