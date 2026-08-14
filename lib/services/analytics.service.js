import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";

/**
 * KPI aggregates for all of a user's agents, or one agent when agentId is set.
 * With no conversations yet, returns zeros and mostCommonTopic: null.
 */
export async function getOverviewForUser(userId, { agentId } = {}) {
  let agentIds;

  if (agentId) {
    await getAgentForUser(agentId, userId);
    agentIds = [agentId];
  } else {
    const agents = await prisma.agent.findMany({
      where: { userId },
      select: { id: true },
    });
    agentIds = agents.map((a) => a.id);
  }

  if (agentIds.length === 0) {
    return emptyOverview();
  }

  const conversations = await prisma.conversation.findMany({
    where: { agentId: { in: agentIds } },
    select: {
      id: true,
      category: true,
      sentiment: true,
      _count: { select: { messages: true } },
    },
  });

  const totalConversations = conversations.length;

  if (totalConversations === 0) {
    return emptyOverview();
  }

  const conversationIds = conversations.map((c) => c.id);

  const [totalMessages, responseAgg] = await Promise.all([
    prisma.message.count({
      where: { conversationId: { in: conversationIds } },
    }),
    prisma.message.aggregate({
      where: {
        conversationId: { in: conversationIds },
        role: "ASSISTANT",
        responseTime: { not: null },
      },
      _avg: { responseTime: true },
    }),
  ]);

  const positiveCount = conversations.filter(
    (c) => c.sentiment === "POSITIVE"
  ).length;
  const negativeCount = conversations.filter(
    (c) => c.sentiment === "NEGATIVE"
  ).length;

  const categoryCounts = {};
  for (const c of conversations) {
    if (!c.category) continue;
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  }

  let mostCommonTopic = null;
  let maxCount = 0;
  for (const [category, count] of Object.entries(categoryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonTopic = category;
    }
  }

  const averageConversationLength =
    totalConversations > 0 ? totalMessages / totalConversations : 0;

  return {
    totalConversations,
    totalMessages,
    averageResponseTimeMs: Math.round(responseAgg._avg.responseTime || 0),
    averageConversationLength: Number(averageConversationLength.toFixed(1)),
    positiveSentimentPercent: Number(
      ((positiveCount / totalConversations) * 100).toFixed(1)
    ),
    negativeSentimentPercent: Number(
      ((negativeCount / totalConversations) * 100).toFixed(1)
    ),
    mostCommonTopic,
  };
}

function emptyOverview() {
  return {
    totalConversations: 0,
    totalMessages: 0,
    averageResponseTimeMs: 0,
    averageConversationLength: 0,
    positiveSentimentPercent: 0,
    negativeSentimentPercent: 0,
    mostCommonTopic: null,
  };
}
