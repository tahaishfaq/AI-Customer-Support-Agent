"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAgent } from "@/lib/api/agents";

/** Avoid full-page skeleton when switching agent studio tabs. */
const agentCache = new Map();

export function useAgentStudio() {
  const params = useParams();
  const id = params?.id;
  const cached = id ? agentCache.get(id) : null;
  const [agent, setAgent] = useState(cached ?? null);
  const [loading, setLoading] = useState(Boolean(id) && !cached);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const hadCache = agentCache.has(id);

    async function load() {
      if (!hadCache) {
        setLoading(true);
      }
      setError("");
      try {
        const data = await getAgent(id);
        if (!cancelled) {
          agentCache.set(id, data);
          setAgent(data);
        }
      } catch (err) {
        if (!cancelled && !agentCache.has(id)) {
          setError(err.message || "Unable to load agent");
          setAgent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return {
    id,
    agent,
    setAgent: (next) => {
      if (id && next) agentCache.set(id, next);
      setAgent(next);
    },
    loading: loading && !agent,
    error,
    deleteOpen,
    setDeleteOpen,
  };
}
