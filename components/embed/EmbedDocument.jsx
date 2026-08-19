"use client";

import { useLayoutEffect } from "react";

export function EmbedDocument() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    html.setAttribute("data-hapy-embed", "1");
    html.style.setProperty("background", "transparent", "important");
    html.style.setProperty("background-color", "transparent", "important");
    html.style.colorScheme = "light";
    body.style.setProperty("background", "transparent", "important");
    body.style.setProperty("background-color", "transparent", "important");
    body.style.display = "flex";
    body.style.alignItems = "flex-end";
    body.style.justifyContent = "flex-end";
    body.style.minHeight = "0";
    body.style.height = "100%";

    function hideDevUi() {
      document.querySelectorAll("nextjs-portal").forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });
    }
    hideDevUi();
    const observer = new MutationObserver(hideDevUi);
    observer.observe(html, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      html.removeAttribute("data-hapy-embed");
    };
  }, []);

  return null;
}
