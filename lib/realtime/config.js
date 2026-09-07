import { REALTIME_DEFAULTS } from "./constants.js";

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function number(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getRealtimeConfig() {
  return {
    enabled: bool("REALTIME_ENABLED"),
    deskEnabled: bool("REALTIME_DESK_ENABLED"),
    embedEnabled: bool("REALTIME_EMBED_ENABLED"),
    billingEnabled: bool("REALTIME_BILLING_ENABLED"),
    url:
      process.env.REALTIME_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.AUTH_URL?.trim() ||
      "http://localhost:3000",
    tokenSecret:
      process.env.REALTIME_TOKEN_SECRET?.trim() ||
      (process.env.NODE_ENV === "production" ? "" : process.env.AUTH_SECRET?.trim() || ""),
    tokenIssuer: process.env.REALTIME_TOKEN_ISSUER?.trim() || "aide-realtime",
    tokenAudience: process.env.REALTIME_TOKEN_AUDIENCE?.trim() || "aide-realtime-client",
    tokenTtlSeconds: number("REALTIME_TOKEN_TTL_SECONDS", REALTIME_DEFAULTS.tokenTtlSeconds),
    redisUrl: process.env.REALTIME_REDIS_URL?.trim() || "",
    redisUsername: process.env.REALTIME_REDIS_USERNAME?.trim() || undefined,
    redisPassword: process.env.REALTIME_REDIS_PASSWORD?.trim() || undefined,
    streamName: process.env.REALTIME_STREAM_NAME?.trim() || "aide:realtime:events",
    dlqStreamName: process.env.REALTIME_DLQ_STREAM_NAME?.trim() || "aide:realtime:dlq",
    consumerGroup: process.env.REALTIME_CONSUMER_GROUP?.trim() || "aide-realtime-fanout",
    consumerName: process.env.REALTIME_CONSUMER_NAME?.trim() || `consumer-${process.pid}`,
    port: number("PORT", 3000),
    allowedOrigins: [
      ...(process.env.REALTIME_ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      process.env.AUTH_URL?.trim(),
      process.env.NEXT_PUBLIC_APP_URL?.trim(),
    ].filter(Boolean),
    maxConnections: number("REALTIME_MAX_CONNECTIONS", REALTIME_DEFAULTS.maxConnections),
    maxConnectionsPerUser: number(
      "REALTIME_MAX_CONNECTIONS_PER_USER",
      REALTIME_DEFAULTS.maxConnectionsPerUser
    ),
    maxConnectionsPerPublicConversation: number(
      "REALTIME_MAX_CONNECTIONS_PER_PUBLIC_CONVERSATION",
      REALTIME_DEFAULTS.maxConnectionsPerPublicConversation
    ),
    maxRoomsPerConnection: number(
      "REALTIME_MAX_ROOMS_PER_CONNECTION",
      REALTIME_DEFAULTS.maxRoomsPerConnection
    ),
    maxEventBytes: number("REALTIME_MAX_EVENT_BYTES", REALTIME_DEFAULTS.maxEventBytes),
    heartbeatIntervalSeconds: number(
      "REALTIME_HEARTBEAT_INTERVAL_SECONDS",
      REALTIME_DEFAULTS.heartbeatIntervalSeconds
    ),
    gracefulShutdownSeconds: number(
      "REALTIME_GRACEFUL_SHUTDOWN_SECONDS",
      REALTIME_DEFAULTS.gracefulShutdownSeconds
    ),
    publishBatchSize: number("REALTIME_PUBLISH_BATCH_SIZE", REALTIME_DEFAULTS.publishBatchSize),
    publishLeaseSeconds: number(
      "REALTIME_PUBLISH_LEASE_SECONDS",
      REALTIME_DEFAULTS.publishLeaseSeconds
    ),
    retryMaxSeconds: number("REALTIME_RETRY_MAX_SECONDS", REALTIME_DEFAULTS.retryMaxSeconds),
    dlqAfterSeconds: number("REALTIME_DLQ_AFTER_SECONDS", REALTIME_DEFAULTS.dlqAfterSeconds),
    streamRetentionSeconds: number(
      "REALTIME_STREAM_RETENTION_SECONDS",
      REALTIME_DEFAULTS.streamRetentionSeconds
    ),
    streamMaxLen: number("REALTIME_STREAM_MAXLEN", 100000),
  };
}

export function assertRealtimeSecret(config = getRealtimeConfig()) {
  if (!config.tokenSecret) {
    throw new Error("REALTIME_TOKEN_SECRET is required for realtime token operations");
  }
  return config;
}

export function assertRedisConfig(config = getRealtimeConfig()) {
  if (!config.redisUrl) {
    throw new Error("REALTIME_REDIS_URL is required for realtime workers/gateway");
  }
  return config;
}
