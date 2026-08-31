/** Local-only welcome message shown before the first server turn. */
export function welcomeBubble(agent) {
  if (!agent?.welcomeMessage) return [];
  const key = agent.publicKey ?? agent.id;
  return [
    {
      id: `welcome-${key}`,
      role: "ASSISTANT",
      content: agent.welcomeMessage,
      responseTime: null,
      local: true,
    },
  ];
}
