import prisma from "@/lib/prisma";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function setMessageFeedback(messageId, rating, { agentId } = {}) {
  const value = rating === "DOWN" ? "DOWN" : "UP";
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { select: { agentId: true } } },
  });
  if (!message) throw httpError(404, "Message not found");
  if (agentId && message.conversation.agentId !== agentId) {
    throw httpError(404, "Message not found");
  }
  if (message.role !== "ASSISTANT") {
    throw httpError(400, "Only assistant replies can be rated");
  }

  return prisma.message.update({
    where: { id: messageId },
    data: { feedback: value },
    select: { id: true, feedback: true },
  });
}
