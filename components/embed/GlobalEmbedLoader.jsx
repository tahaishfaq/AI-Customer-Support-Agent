"use client";

import { useEffect } from "react";

const EMBED_SCRIPT_ID = "aide-global-embed-script";
const EMBED_PUBLIC_KEY = "PNFGb0G4S-24aZ7RlJi0r-PE";

export function GlobalEmbedLoader() {
  useEffect(() => {
    try {
      if (window.top !== window.self) return;
    } catch {
      return;
    }

    if (document.getElementById(EMBED_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = EMBED_SCRIPT_ID;
    script.src = "/embed.js?v=11";
    script.defer = true;
    script.dataset.aideKey = EMBED_PUBLIC_KEY;
    document.head.appendChild(script);
  }, []);

  return null;
}
