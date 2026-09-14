import { queryKeys } from "@/lib/query/keys";

export function invalidateDeskQueries(queryClient, conversationId) {
  const keys = [
    queryKeys.desk.waiting,
    ["desk", "inbox"],
    ["desk", "stats"],
  ];
  if (conversationId) keys.push(queryKeys.desk.thread(conversationId));
  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}

export function invalidateKnowledgeQuery(queryClient, agentId) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.knowledge.list(agentId),
  });
}

export function invalidateActionsQuery(queryClient, agentId) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.actions.list(agentId),
  });
}

export function invalidateMcpQuery(queryClient, agentId) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.mcp.list(agentId),
  });
}
