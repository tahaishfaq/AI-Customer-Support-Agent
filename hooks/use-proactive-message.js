"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizePath, normalizeProactiveRules, pickProactiveRule } from "@/lib/embed/proactive-rules";

const storageKey = (publicKey) => `aide-proactive-v1:${publicKey}`;

/** Storage may be blocked (private mode, sandboxed iframe): fall back to this page load only. */
function readIds(storage, key) {
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

function writeIds(storage, key, ids) {
  try {
    storage?.setItem(key, JSON.stringify(ids.slice(-50)));
  } catch {
    // Storage blocked: the in-memory copy still stops repeats on this page load.
  }
}

const safeStorage = (name) => {
  try {
    return typeof window === "undefined" ? null : window[name];
  } catch {
    return null;
  }
};

/**
 * Level 2 · P6 — which proactive bubble to show, after its delay. Never while the chat is open or the
 * visitor is already chatting. Returns { message, dismiss }.
 * @param {{ deploy: object, publicKey: string, path: string|null, identified: boolean, open: boolean, chatting: boolean }} input
 */
export function useProactiveMessage({ deploy, publicKey, path, identified, open, chatting }) {
  const rules = useMemo(() => normalizeProactiveRules(deploy), [deploy]);
  const key = storageKey(publicKey || "unknown");
  const [seen, setSeen] = useState(() => ({
    visitor: readIds(safeStorage("localStorage"), key),
    session: readIds(safeStorage("sessionStorage"), key),
    page: [],
  }));
  const [shown, setShown] = useState(null);

  // Path-specific rules wait for the host to send its path; "every page" rules work without it.
  const pagePath = path ? normalizePath(path) : "/";
  const usableRules = useMemo(() => (path ? rules : rules.filter((rule) => rule.match === "any")), [rules, path]);
  // One bubble per page: nothing new while one is showing here or after it was dismissed here.
  const showingHere = Boolean(shown && shown.key.endsWith(`@${pagePath}`));
  const dismissedHere = seen.page.includes(pagePath);
  const candidate = useMemo(
    () =>
      open || chatting || showingHere || dismissedHere
        ? null
        : pickProactiveRule({ rules: usableRules, path: pagePath, identified, seen }),
    [open, chatting, showingHere, dismissedHere, usableRules, pagePath, identified, seen]
  );
  const candidateKey = candidate ? `${candidate.id}@${pagePath}` : null;

  useEffect(() => {
    if (!candidate) return undefined;
    const timer = setTimeout(() => {
      setShown({ rule: candidate, key: candidateKey });
      // A shown once-per-session / once-per-visitor message counts as used.
      if (candidate.frequency === "once_per_visitor") {
        const visitor = [...seen.visitor, candidate.id];
        writeIds(safeStorage("localStorage"), key, visitor);
        setSeen((current) => ({ ...current, visitor }));
      } else if (candidate.frequency === "once_per_session") {
        const session = [...seen.session, candidate.id];
        writeIds(safeStorage("sessionStorage"), key, session);
        setSeen((current) => ({ ...current, session }));
      }
    }, candidate.delaySeconds * 1000);
    return () => clearTimeout(timer);
    // Restart only when the rule or page changes, not when `seen` records this very rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey]);

  const dismiss = useCallback(() => {
    setSeen((current) => ({ ...current, page: [...current.page, pagePath] }));
    setShown(null);
  }, [pagePath]);

  // Hide when the chat opens, the visitor starts chatting, or they move to another page.
  const visible = showingHere && !open && !chatting;
  return { message: visible ? shown.rule.message : null, dismiss };
}
