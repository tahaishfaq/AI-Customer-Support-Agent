"use client";

import { useEffect } from "react";
import { GOOGLE_GIS_SCRIPT_SRC } from "@/lib/auth/google-gis";
import { GoogleGsiBoot } from "@/components/auth/GoogleGsiBoot";

const GOOGLE_GSI_SCRIPT_ID = "google-gsi-script";

/**
 * Root layout: load GIS before hydration so /login does not flash "Loading Google…".
 */
export function GoogleGsiLoader() {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  return <GoogleGsiLoaderClient />;
}

function GoogleGsiLoaderClient() {
  useEffect(() => {
    if (document.getElementById(GOOGLE_GSI_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = GOOGLE_GSI_SCRIPT_ID;
    script.src = GOOGLE_GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  return <GoogleGsiBoot />;
}
