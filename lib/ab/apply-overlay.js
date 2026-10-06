/**
 * Level 3 · L8 — apply A/B revision overlay for a public conversation (in-memory only).
 */

import prisma from "@/lib/prisma";
import { abVisitorKey, assignAbBucket, normalizeAbTest } from "@/lib/ab/bucket";

/**
 * Persist abBucket if missing and return agent fields from the assigned revision.
 * @param {object} agent
 * @param {object} conversation
 * @returns {Promise<{ agent: object, conversation: object }>}
 */
export async function applyAbTestOverlay(agent, conversation) {
  if (!agent?.id || !conversation?.id) {
    return { agent, conversation };
  }
  const config = normalizeAbTest(agent.abTest);
  if (!config.enabled || config.revisionA == null || config.revisionB == null) {
    return { agent, conversation };
  }

  let bucket = conversation.abBucket ? String(conversation.abBucket) : null;
  let revisionVersion = null;

  if (!bucket) {
    const assigned = assignAbBucket(abVisitorKey(conversation), config);
    if (!assigned) return { agent, conversation };
    bucket = assigned.bucket;
    revisionVersion = assigned.revisionVersion;
    try {
      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { abBucket: bucket },
      });
      conversation = { ...conversation, ...updated };
    } catch {
      // Best effort — still apply overlay for this turn.
      conversation = { ...conversation, abBucket: bucket };
    }
  } else {
    revisionVersion = bucket === "B" ? config.revisionB : config.revisionA;
  }

  if (revisionVersion == null) return { agent, conversation };

  const rev = await prisma.agentRevision.findUnique({
    where: {
      agentId_version: { agentId: agent.id, version: Number(revisionVersion) },
    },
    select: { snapshot: true },
  });
  const snap = rev?.snapshot && typeof rev.snapshot === "object" ? rev.snapshot : null;
  if (!snap) return { agent, conversation };

  return {
    agent: {
      ...agent,
      systemPrompt:
        snap.systemPrompt != null ? String(snap.systemPrompt) : agent.systemPrompt,
      welcomeMessage:
        snap.welcomeMessage != null
          ? String(snap.welcomeMessage)
          : agent.welcomeMessage,
      guidance: Array.isArray(snap.guidance) ? snap.guidance : agent.guidance,
      answerStyle: snap.answerStyle || agent.answerStyle,
      webSearchEnabled:
        snap.webSearchEnabled != null
          ? Boolean(snap.webSearchEnabled)
          : agent.webSearchEnabled,
      customization:
        snap.customization != null ? snap.customization : agent.customization,
    },
    conversation,
  };
}
