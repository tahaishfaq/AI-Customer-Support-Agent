import Script from "next/script";
import { GOOGLE_GIS_SCRIPT_SRC } from "@/lib/auth/google-gis";
import { GoogleGsiBoot } from "@/components/auth/GoogleGsiBoot";

/**
 * Root layout: load GIS before hydration so /login does not flash "Loading Google…".
 */
export function GoogleGsiLoader() {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <Script
        id="google-gsi-script"
        src={GOOGLE_GIS_SCRIPT_SRC}
        strategy="beforeInteractive"
      />
      <GoogleGsiBoot />
    </>
  );
}
