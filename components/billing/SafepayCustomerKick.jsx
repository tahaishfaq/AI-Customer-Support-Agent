"use client";

import { useEffect, useRef } from "react";
import { ensureSafepayCustomer } from "@/lib/api/onboarding";

/**
 * After plans page paints, create SafePay customer in the background
 * while the user reads plan options.
 */
export function SafepayCustomerKick() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ensureSafepayCustomer().catch(() => {});
  }, []);

  return null;
}
