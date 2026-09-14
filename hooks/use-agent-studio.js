"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAgent } from "@/lib/api/agents";
import { queryKeys } from "@/lib/query/keys";

/** Shared Query cache avoids refetching the agent on every studio tab. */
export function useAgentStudio() {
  const params = useParams();
  const id = params?.id;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.agents.detail(id),
    queryFn: () => getAgent(id),
    enabled: Boolean(id),
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  return {
    id,
    agent: query.data ?? null,
    setAgent: (next) => {
      if (id) {
        queryClient.setQueryData(queryKeys.agents.detail(id), (current) =>
          typeof next === "function" ? next(current) : next
        );
      }
    },
    loading: query.isPending,
    error: query.error?.message || "",
    deleteOpen,
    setDeleteOpen,
  };
}
