export const REALTIME_EVENT_SCHEMA_VERSION = 1;

export const REALTIME_EVENT_TYPES = Object.freeze({
  HANDOFF_CREATED: "conversation.handoff.created",
  MESSAGE_CREATED: "conversation.message.created",
  CLAIM_UPDATED: "conversation.claim.updated",
  STATUS_UPDATED: "conversation.status.updated",
  PRIORITY_UPDATED: "conversation.priority.updated",
  CSAT_UPDATED: "conversation.csat.updated",
  INBOX_SEEN_UPDATED: "workspace.inbox-seen.updated",
  BILLING_SUBSCRIPTION_UPDATED: "billing.subscription.updated",
  BILLING_QUOTA_UPDATED: "billing.quota.updated",
  ACCESS_REVOKED: "access.revoked",
  TYPING_STARTED: "conversation.typing.started",
  TYPING_STOPPED: "conversation.typing.stopped",
  PRESENCE_UPDATED: "presence.updated",
  VIEWING_STARTED: "conversation.viewing.started",
  VIEWING_STOPPED: "conversation.viewing.stopped",
});

export const REALTIME_VISIBILITIES = Object.freeze({
  OWNER: "OWNER",
  PUBLIC: "PUBLIC",
  BOTH: "BOTH",
});

export const REALTIME_ROOMS = Object.freeze({
  user: (userId) => `user:${userId}`,
  workspaceDesk: (workspaceId) => `workspace:${workspaceId}:desk`,
  conversationOwner: (conversationId) => `conversation:${conversationId}:owner`,
  conversationPublic: (conversationId) => `conversation:${conversationId}:public`,
});

export const REALTIME_DEFAULTS = Object.freeze({
  tokenTtlSeconds: 300,
  heartbeatIntervalSeconds: 25,
  gracefulShutdownSeconds: 20,
  maxConnections: 1000,
  maxConnectionsPerUser: 10,
  maxConnectionsPerPublicConversation: 20,
  maxRoomsPerConnection: 10,
  maxEventBytes: 64 * 1024,
  publishBatchSize: 50,
  publishLeaseSeconds: 30,
  retryMaxSeconds: 300,
  dlqAfterSeconds: 24 * 60 * 60,
  streamRetentionSeconds: 24 * 60 * 60,
});
