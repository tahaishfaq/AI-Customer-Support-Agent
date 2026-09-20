"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * When logged in, hydrate app shell theme from User.uiTheme (account source of truth).
 * Cookie/localStorage stay as SSR cache.
 */
export function ThemeAccountSync() {
  const { data: session, status } = useSession();
  const { setTheme, forcedTheme } = useTheme();
  const syncedFor = useRef(null);

  useEffect(() => {
    if (forcedTheme) return;
    if (status !== "authenticated" || !session?.user?.id) return;
    if (syncedFor.current === session.user.id) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/theme", { credentials: "same-origin" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const theme = data?.theme === "dark" ? "dark" : "light";
        if (cancelled) return;
        syncedFor.current = session.user.id;
        setTheme(theme);
      } catch {
        // Keep local cookie theme if sync fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [forcedTheme, session?.user?.id, setTheme, status]);

  return null;
}
