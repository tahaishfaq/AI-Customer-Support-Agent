"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext(null);

function initialTheme(forcedTheme, defaultTheme, storageKey) {
  if (forcedTheme) return forcedTheme;
  if (typeof window === "undefined") return defaultTheme;
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved === "dark" ? "dark" : "light";
  } catch {
    return defaultTheme;
  }
}

function applyTheme(theme, attribute) {
  const root = document.documentElement;
  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  } else {
    root.setAttribute(attribute, theme);
  }
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
  attribute = "data-theme",
  defaultTheme = "light",
  forcedTheme,
  storageKey = "theme",
}) {
  const [theme, setThemeState] = useState(() =>
    initialTheme(forcedTheme, defaultTheme, storageKey)
  );

  const setTheme = useCallback(
    (nextTheme) => {
      if (forcedTheme) return;
      setThemeState((current) => {
        const next = typeof nextTheme === "function" ? nextTheme(current) : nextTheme;
        try {
          window.localStorage.setItem(storageKey, next);
        } catch {
          // Storage can be unavailable in private or restricted contexts.
        }
        return next;
      });
    },
    [forcedTheme, storageKey]
  );

  useLayoutEffect(() => {
    if (forcedTheme) {
      applyTheme(forcedTheme, attribute);
      return undefined;
    }

    let saved = null;
    try {
      saved = window.localStorage.getItem(storageKey);
    } catch {
      // Use the default theme when storage is unavailable.
    }
    applyTheme(saved === "dark" ? "dark" : "light", attribute);

    function handleStorage(event) {
      if (event.key !== storageKey) return;
      const next = event.newValue === "dark" ? "dark" : "light";
      setThemeState(next);
      applyTheme(next, attribute);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [attribute, forcedTheme, storageKey]);

  useEffect(() => {
    if (!forcedTheme) applyTheme(theme, attribute);
  }, [attribute, forcedTheme, theme]);

  const effectiveTheme = forcedTheme || theme;

  const value = useMemo(
    () => ({
      theme: effectiveTheme,
      setTheme,
      forcedTheme,
      resolvedTheme: effectiveTheme,
      systemTheme: undefined,
      themes: ["light", "dark"],
    }),
    [effectiveTheme, forcedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
