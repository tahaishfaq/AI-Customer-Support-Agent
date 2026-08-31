/** Append assistant turn from chat API; skip user bubble when resuming after confirm. */
export function mergeAssistantReply(prev, result) {
  const next = [...prev];
  if (result.userMessage) {
    next.push({
      id: result.userMessage.id,
      role: result.userMessage.role,
      content: result.userMessage.content,
      createdAt: result.userMessage.createdAt,
    });
  }
  if (result.message) {
    next.push({
      id: result.message.id,
      role: result.message.role,
      content: result.message.content,
      responseTime: result.message.responseTime,
      createdAt: result.message.createdAt,
      toolSteps: result.toolSteps || [],
      pendingConfirmations: result.pendingConfirmations || [],
      usedKnowledge: result.usedKnowledge,
    });
  }
  return next;
}
