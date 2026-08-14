"use client";

import { useEffect } from "react";
import { useBreadcrumbStore } from "@/store/breadcrumb-store";

export function useAgentCrumb(name) {
  const setAgentName = useBreadcrumbStore((s) => s.setAgentName);

  useEffect(() => {
    setAgentName(name || null);
    return () => setAgentName(null);
  }, [name, setAgentName]);
}
