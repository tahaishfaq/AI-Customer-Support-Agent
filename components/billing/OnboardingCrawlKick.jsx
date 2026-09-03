"use client";

import { useEffect, useRef } from "react";
import { kickOnboardingCrawl } from "@/lib/api/onboarding";

/** Once per session: start deferred website crawl after the user reaches the app. */
export function OnboardingCrawlKick() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void kickOnboardingCrawl().catch(() => {});
  }, []);

  return null;
}
