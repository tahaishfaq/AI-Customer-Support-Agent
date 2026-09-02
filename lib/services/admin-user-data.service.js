import prisma from "@/lib/prisma";
import { deleteCloudinaryAsset } from "@/lib/utils/cloudinary-pdf";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

export async function exportAdminUser(userId) {
  const MESSAGE_CAP = 2_000;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      workspaces: {
        orderBy: { createdAt: "asc" },
        include: {
          agents: {
            orderBy: { createdAt: "asc" },
            include: {
              knowledgeDocs: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  name: true,
                  type: true,
                  content: true,
                  fileUrl: true,
                  sourceUrl: true,
                  createdAt: true,
                },
              },
              conversations: {
                orderBy: { startedAt: "asc" },
                include: {
                  messages: {
                    orderBy: { createdAt: "asc" },
                    take: MESSAGE_CAP,
                  },
                  _count: { select: { messages: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) throw httpError(404, "User not found");

  let messageCount = 0;
  let truncated = false;

  const workspaces = user.workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    agents: workspace.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      welcomeMessage: agent.welcomeMessage,
      customization: agent.customization,
      publicKey: agent.publicKey,
      enabled: agent.enabled,
      embedEnabled: agent.embedEnabled,
      knowledge: agent.knowledgeDocs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        content: doc.content,
        fileUrl: doc.fileUrl,
        sourceUrl: doc.sourceUrl,
        createdAt: doc.createdAt,
      })),
      conversations: agent.conversations.map((conversation) => {
        const totalMessages = conversation._count?.messages ?? conversation.messages.length;
        if (totalMessages > conversation.messages.length) truncated = true;
        messageCount += conversation.messages.length;
        if (messageCount > MESSAGE_CAP) truncated = true;
        return {
          id: conversation.id,
          category: conversation.category,
          sentiment: conversation.sentiment,
          startedAt: conversation.startedAt,
          endedAt: conversation.endedAt,
          messageCount: totalMessages,
          messages: conversation.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            responseTime: message.responseTime,
            feedback: message.feedback,
            createdAt: message.createdAt,
          })),
        };
      }),
    })),
  }));

  return {
    exportedAt: new Date().toISOString(),
    truncated,
    messageCap: MESSAGE_CAP,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    workspaces,
  };
}

export async function hardDeleteAdminUser(userId, { emailConfirm } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      agents: {
        select: {
          knowledgeDocs: { select: { cloudinaryPublicId: true } },
        },
      },
    },
  });

  if (!user) throw httpError(404, "User not found");
  if (user.role === "ADMIN") {
    throw httpError(400, "The platform admin cannot be deleted");
  }

  const expected = String(user.email || "").trim().toLowerCase();
  const typed = String(emailConfirm || "").trim().toLowerCase();
  if (!typed || typed !== expected) {
    throw httpError(400, "Type the user’s email to confirm delete", {
      emailConfirm: "Must match the account email",
    });
  }

  const publicIds = user.agents.flatMap((agent) =>
    agent.knowledgeDocs.map((doc) => doc.cloudinaryPublicId).filter(Boolean)
  );

  await prisma.user.delete({ where: { id: userId } });

  await Promise.all(
    publicIds.map(async (publicId) => {
      try {
        await deleteCloudinaryAsset(publicId);
      } catch (error) {
        console.error("hardDelete cloudinary", publicId, error?.message || error);
      }
    })
  );

  return { id: user.id, email: user.email, name: user.name };
}