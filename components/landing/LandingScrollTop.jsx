"use client";

import { useEffect } from "react";

export function LandingScrollTop() {
  useEffect(() => {
    const { history } = window;
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";

    const scrollTop = () => {
      window.scrollTo(0, 0);
    };

    scrollTop();
    requestAnimationFrame(scrollTop);

    const onPageShow = (event) => {
      if (event.persisted) scrollTop();
    };

    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      history.scrollRestoration = previous;
    };
  }, []);

  return null;
}
