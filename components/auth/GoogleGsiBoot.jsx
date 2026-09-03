"use client";

import { useLayoutEffect } from "react";
import {
  googleGisApiReady,
  markGoogleGisReady,
  retryGoogleGisReady,
} from "@/lib/auth/google-gis";

/** Marks GIS ready after root `beforeInteractive` script (or retries briefly). */
export function GoogleGsiBoot() {
  useLayoutEffect(() => {
    if (googleGisApiReady()) {
      markGoogleGisReady();
      return;
    }
    retryGoogleGisReady();
  }, []);

  return null;
}
