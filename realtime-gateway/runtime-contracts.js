import { jwtVerify } from "jose";

const defaults = {
  heartbeatIntervalSeconds: 25,
  maxRoomsPerConnection: 10,
  maxEventBytes: 64 * 1024,
  ephemeralRateLimitPerMinute: 120,
  typingTtlSeconds: 5,
  typingDebounceMilliseconds: 350,
  maxConnections: 1000,
  maxConnectionsPerUser: 10,
  maxConnectionsPerPublicConversation: 20,
  connectionRateLimitPerMinute: 120,
  streamName: "aide:realtime:events",
  consumerGroup: "aide-realtime-fanout",
  port: 4100,
};

function number(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getGatewayConfig() {
  const configuredOrigins = (process.env.REALTIME_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const appOrigins = [process.env.AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]
    .map((value) => value?.trim())
    .filter(Boolean);
  return {
    tokenSecret: process.env.REALTIME_TOKEN_SECRET?.trim() || "",
    tokenIssuer: process.env.REALTIME_TOKEN_ISSUER?.trim() || "aide-realtime",
    tokenAudience: process.env.REALTIME_TOKEN_AUDIENCE?.trim() || "aide-realtime-client",
    redisUrl: process.env.REALTIME_REDIS_URL?.trim() || "",
    redisUsername: process.env.REALTIME_REDIS_USERNAME?.trim() || undefined,
    redisPassword: process.env.REALTIME_REDIS_PASSWORD?.trim() || undefined,
    streamName: process.env.REALTIME_STREAM_NAME?.trim() || defaults.streamName,
    consumerGroup: process.env.REALTIME_CONSUMER_GROUP?.trim() || defaults.consumerGroup,
    consumerName: process.env.REALTIME_CONSUMER_NAME?.trim() || `gateway-${process.pid}`,
    port: number("PORT", defaults.port),
    allowedOrigins: [...new Set([...configuredOrigins, ...appOrigins])],
    maxRoomsPerConnection: number("REALTIME_MAX_ROOMS_PER_CONNECTION", defaults.maxRoomsPerConnection),
    maxEventBytes: number("REALTIME_MAX_EVENT_BYTES", defaults.maxEventBytes),
    ephemeralRateLimitPerMinute: number("REALTIME_EPHEMERAL_RATE_LIMIT_PER_MINUTE", defaults.ephemeralRateLimitPerMinute),
    typingTtlSeconds: number("REALTIME_TYPING_TTL_SECONDS", defaults.typingTtlSeconds),
    typingDebounceMilliseconds: number("REALTIME_TYPING_DEBOUNCE_MS", defaults.typingDebounceMilliseconds),
    heartbeatIntervalSeconds: number("REALTIME_HEARTBEAT_INTERVAL_SECONDS", defaults.heartbeatIntervalSeconds),
    maxConnections: number("REALTIME_MAX_CONNECTIONS", defaults.maxConnections),
    maxConnectionsPerUser: number("REALTIME_MAX_CONNECTIONS_PER_USER", defaults.maxConnectionsPerUser),
    maxConnectionsPerPublicConversation: number("REALTIME_MAX_CONNECTIONS_PER_PUBLIC_CONVERSATION", defaults.maxConnectionsPerPublicConversation),
    connectionRateLimitPerMinute: number("REALTIME_CONNECTION_RATE_LIMIT_PER_MINUTE", defaults.connectionRateLimitPerMinute),
  };
}

export const rooms = {
  user: (id) => `user:${id}`,
  workspaceDesk: (id) => `workspace:${id}:desk`,
  conversationOwner: (id) => `conversation:${id}:owner`,
  conversationPublic: (id) => `conversation:${id}:public`,
};

export async function verifyGatewayToken(token, config) {
  if (!config.tokenSecret) throw new Error("Realtime token secret is missing");
  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.tokenSecret), {
    issuer: config.tokenIssuer,
    audience: config.tokenAudience,
    algorithms: ["HS256"],
  });
  if (!payload.jti || !payload.sid || !payload.typ) throw new Error("Invalid realtime claims");
  if (payload.typ === "aide-realtime-owner") {
    if (!payload.sub || !Array.isArray(payload.workspaceIds)) throw new Error("Invalid owner claims");
    return payload;
  }
  if (payload.typ === "aide-realtime-public-conversation" && payload.sub?.startsWith("conversation:") && payload.conversationId && payload.agentId) return payload;
  throw new Error("Invalid realtime token type");
}

export function canJoinRoom(claims, room) {
  if (claims.typ === "aide-realtime-owner") {
    if (room === rooms.user(claims.sub)) return true;
    const workspace = room.match(/^workspace:([^:]+):desk$/)?.[1];
    if (workspace) return claims.workspaceIds.includes(workspace);
    const conversation = room.match(/^conversation:([^:]+):owner$/)?.[1];
    return Boolean(conversation && claims.conversationIds?.includes(conversation));
  }
  return claims.typ === "aide-realtime-public-conversation" && room === rooms.conversationPublic(claims.conversationId);
}

export function parseEvent(raw) {
  const event = JSON.parse(raw);
  if (!event?.eventId || !event?.eventType || !event?.aggregateType || typeof event.aggregateVersion !== "number" || !["OWNER", "PUBLIC", "BOTH"].includes(event.visibility) || typeof event.payload !== "object") {
    throw new Error("Invalid realtime event envelope");
  }
  return event;
}
