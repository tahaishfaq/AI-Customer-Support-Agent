import Redis from "ioredis";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import {
  canJoinRoom,
  getGatewayConfig,
  parseEvent,
  rooms,
  verifyGatewayToken,
} from "./runtime-contracts.js";
import {
  assertOwnerConversationAccess,
  assertPublicConversationAccess,
  assertRealtimeSessionActive,
  closeSessionCheckPool,
} from "./session-check.js";
import {
  ephemeralRooms,
  parseEphemeralEvent,
} from "../lib/realtime/ephemeral.js";
import { REALTIME_EVENT_TYPES } from "../lib/realtime/constants.js";
import {
  createSlidingWindowRateLimiter,
  createTypingLeaseManager,
} from "./ephemeral-runtime.js";
import {
  isOwnerBusinessEventType,
  parseOwnerBusinessEvent,
} from "../lib/realtime/business-events.js";

export async function attachRealtimeGateway(httpServer) {
  const config = getGatewayConfig();
  if (!config.redisUrl) throw new Error("REALTIME_REDIS_URL is required");

  const redisOptions = {
    username: config.redisUsername,
    password: config.redisPassword,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
  const pubClient = new Redis(config.redisUrl, redisOptions);
  const subClient = pubClient.duplicate();
  const streamClient = pubClient.duplicate();
  let stopped = false;
  const metrics = {
    connectionsAccepted: 0,
    connectionsClosed: 0,
    connectionsRejected: 0,
    authRejected: 0,
    roomJoinRejected: 0,
    streamEventsDelivered: 0,
    streamEventsRejected: 0,
    redisErrors: 0,
    lastConnectionRejectionReason: null,
    lastDisconnectReason: null,
  };
  const connectionAttempts = new Map();

  function consumeConnectionAttempt(key) {
    const now = Date.now();
    if (connectionAttempts.size > 10_000) {
      for (const [candidate, timestamps] of connectionAttempts) {
        if (!timestamps.some((timestamp) => now - timestamp < 60_000)) {
          connectionAttempts.delete(candidate);
        }
      }
    }
    const active = (connectionAttempts.get(key) || []).filter(
      (timestamp) => now - timestamp < 60_000
    );
    if (active.length >= config.connectionRateLimitPerMinute) {
      connectionAttempts.set(key, active);
      return false;
    }
    active.push(now);
    connectionAttempts.set(key, active);
    return true;
  }

  const io = new Server(httpServer, {
    transports: ["websocket", "polling"],
    cors: {
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Realtime origin is not allowed"));
      },
      credentials: true,
    },
    pingInterval: config.heartbeatIntervalSeconds * 1000,
    maxHttpBufferSize: config.maxEventBytes,
    adapter: createAdapter(pubClient, subClient),
  });

  function disconnectUser(userId, reason = "access-revoked") {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.claims?.sub === userId) socket.disconnect(true, reason);
    }
  }

  function rejectionReason(error) {
    const message = String(error?.message || "unknown").toLowerCase();
    if (message.includes("rate limit")) return "rate_limited";
    if (message.includes("capacity")) return "capacity";
    if (message.includes("origin")) return "origin_not_allowed";
    if (message.includes("session") || message.includes("token") || message.includes("auth")) {
      return "authentication_failed";
    }
    return "rejected";
  }

  io.use(async (socket, next) => {
    try {
      const ip = socket.handshake.address || "unknown";
      if (!consumeConnectionAttempt(ip)) throw new Error("Connection rate limit exceeded");
      if (io.engine.clientsCount >= config.maxConnections) throw new Error("Realtime capacity exceeded");
      const token = socket.handshake.auth?.token;
      const claims = await verifyGatewayToken(token, config);
      if (
        claims.typ === "aide-realtime-owner" &&
        !(await assertRealtimeSessionActive({
          sessionId: claims.sid,
          tokenId: claims.jti,
          userId: claims.sub,
        }))
      ) {
        throw new Error("Realtime session is revoked or expired");
      }
      if (
        claims.typ === "aide-realtime-public-conversation" &&
        !(await assertPublicConversationAccess({
          accessId: claims.sid,
          conversationId: claims.conversationId,
          agentId: claims.agentId,
        }))
      ) {
        throw new Error("Public realtime capability is revoked or expired");
      }
      socket.data.claims = claims;
      socket.data.expiresAt = claims.exp * 1000;
      const matchingConnections = [...io.sockets.sockets.values()].filter(
        (candidate) =>
          candidate.data.claims?.typ === claims.typ &&
          (claims.typ === "aide-realtime-owner"
            ? candidate.data.claims?.sub === claims.sub
            : candidate.data.claims?.conversationId === claims.conversationId)
      ).length;
      const maxMatching = claims.typ === "aide-realtime-owner"
        ? config.maxConnectionsPerUser
        : config.maxConnectionsPerPublicConversation;
      if (matchingConnections >= maxMatching) throw new Error("Realtime identity capacity exceeded");
      metrics.connectionsAccepted += 1;
      next();
    } catch (error) {
      metrics.connectionsRejected += 1;
      const reason = rejectionReason(error);
      metrics.lastConnectionRejectionReason = reason;
      if (reason === "authentication_failed") {
        metrics.authRejected += 1;
      }
      console.warn("[realtime] connection rejected", { reason });
      next(new Error("Realtime authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const claims = socket.data.claims;
    console.info("[realtime] connected", {
      socketId: socket.id,
      connectionType: claims.typ,
      activeConnections: io.engine.clientsCount,
    });
    const expiryTimer = setTimeout(
      () => socket.disconnect(true, "token-expired"),
      Math.max(1, socket.data.expiresAt - Date.now())
    );
    const revocationTimer =
      claims.typ === "aide-realtime-owner" ||
      claims.typ === "aide-realtime-public-conversation"
        ? setInterval(async () => {
            const active =
              claims.typ === "aide-realtime-owner"
                ? await assertRealtimeSessionActive({
                    sessionId: claims.sid,
                    tokenId: claims.jti,
                    userId: claims.sub,
                  }).catch(() => false)
                : await assertPublicConversationAccess({
                    accessId: claims.sid,
                    conversationId: claims.conversationId,
                    agentId: claims.agentId,
                  }).catch(() => false);
            if (!active) socket.disconnect(true, "access-revoked");
          }, Math.max(10_000, config.heartbeatIntervalSeconds * 1000))
        : null;

    const ephemeralRateLimiter = createSlidingWindowRateLimiter({
      max: config.ephemeralRateLimitPerMinute,
      windowMs: 60_000,
    });
    const typingLeases = createTypingLeaseManager({
      ttlMs: config.typingTtlSeconds * 1000,
      debounceMs: config.typingDebounceMilliseconds,
    });

    function emitEphemeral(eventType, payload) {
      for (const room of ephemeralRooms({ eventType, payload })) {
        io.to(room).emit(eventType, { eventType, payload });
      }
    }

    function acknowledge(callback, result) {
      if (typeof callback === "function") callback(result);
    }

    function assertEphemeralRoomAccess(eventType, payload) {
      const isTyping =
        eventType === REALTIME_EVENT_TYPES.TYPING_STARTED ||
        eventType === REALTIME_EVENT_TYPES.TYPING_STOPPED;
      const isPresence = eventType === REALTIME_EVENT_TYPES.PRESENCE_UPDATED;
      const isViewing =
        eventType === REALTIME_EVENT_TYPES.VIEWING_STARTED ||
        eventType === REALTIME_EVENT_TYPES.VIEWING_STOPPED;

      if (claims.typ === "aide-realtime-public-conversation") {
        if (!isTyping || payload.actorType !== "PUBLIC" || payload.conversationId !== claims.conversationId) {
          throw new Error("Public ephemeral event denied");
        }
        if (!socket.rooms.has(rooms.conversationPublic(claims.conversationId))) {
          throw new Error("Public conversation room is not joined");
        }
        return;
      }

      if (isTyping && payload.actorType !== "OWNER") {
        throw new Error("Owner typing actor is required");
      }
      if (isTyping && payload.actorId && payload.actorId !== claims.sub) {
        throw new Error("Typing actor does not match session");
      }
      if ((isPresence || isViewing) && payload.userId !== claims.sub) {
        throw new Error("Ephemeral actor does not match session");
      }
      if (isPresence && (!claims.workspaceIds.includes(payload.workspaceId) || payload.actorType !== "OWNER")) {
        throw new Error("Workspace presence access denied");
      }
      if ((isTyping || isViewing) && !socket.rooms.has(rooms.conversationOwner(payload.conversationId))) {
        throw new Error("Conversation room is not joined");
      }
      if (!isTyping && !isPresence && !isViewing) throw new Error("Ephemeral event denied");
      if (isPresence && !socket.rooms.has(rooms.workspaceDesk(payload.workspaceId))) {
        throw new Error("Workspace desk room is not joined");
      }
      if (isPresence && payload.conversationId && !socket.rooms.has(rooms.conversationOwner(payload.conversationId))) {
        throw new Error("Conversation room is not joined");
      }
    }

    socket.on("ephemeral:event", (raw, callback = () => {}) => {
      try {
        if (!ephemeralRateLimiter.consume("ephemeral")) {
          throw new Error("Ephemeral event rate limit exceeded");
        }
        const parsed = parseEphemeralEvent(raw);
        assertEphemeralRoomAccess(parsed.eventType, parsed.payload);

        const isTypingStart = parsed.eventType === REALTIME_EVENT_TYPES.TYPING_STARTED;
        const isTypingStop = parsed.eventType === REALTIME_EVENT_TYPES.TYPING_STOPPED;
        const leaseKey = `${parsed.payload.actorType}:${parsed.payload.conversationId}`;
        if (isTypingStart) {
          const lease = typingLeases.start(leaseKey, () => {
            emitEphemeral(REALTIME_EVENT_TYPES.TYPING_STOPPED, {
              ...parsed.payload,
              expiresAt: null,
            });
          });
          if (lease.shouldEmit) {
            emitEphemeral(REALTIME_EVENT_TYPES.TYPING_STARTED, {
              ...parsed.payload,
              expiresAt: new Date(lease.expiresAt).toISOString(),
            });
          }
        } else if (isTypingStop) {
          if (typingLeases.stop(leaseKey)) {
            emitEphemeral(REALTIME_EVENT_TYPES.TYPING_STOPPED, {
              ...parsed.payload,
              expiresAt: null,
            });
          }
        } else {
          emitEphemeral(parsed.eventType, parsed.payload);
        }
        acknowledge(callback, { ok: true });
      } catch (error) {
        acknowledge(callback, { ok: false, error: error.message });
      }
    });

    if (claims.typ === "aide-realtime-owner") {
      socket.join(rooms.user(claims.sub));
    }

    socket.on("room:join", async (raw, callback = () => {}) => {
      try {
        const room = raw?.room;
        if (typeof room !== "string" || room.length < 1 || room.length > 240) {
          throw new Error("Invalid room");
        }
        if (socket.rooms.size >= config.maxRoomsPerConnection) {
          throw new Error("Room limit exceeded");
        }
        const ownerConversationId =
          claims.typ === "aide-realtime-owner"
            ? room.match(/^conversation:([^:]+):owner$/)?.[1]
            : null;
        const allowed =
          canJoinRoom(claims, room) ||
          (ownerConversationId &&
            (await assertOwnerConversationAccess({
              userId: claims.sub,
              conversationId: ownerConversationId,
            })));
        if (!allowed) throw new Error("Room access denied");
        socket.join(room);
        callback({ ok: true, room });
      } catch (error) {
        metrics.roomJoinRejected += 1;
        callback({ ok: false, error: error.message });
      }
    });

    socket.on("room:leave", (raw, callback = () => {}) => {
      const room = raw?.room;
      if (typeof room !== "string" || room.length < 1 || room.length > 240) {
        return callback({ ok: false, error: "Invalid room" });
      }
      socket.leave(room);
      callback({ ok: true, room });
    });

    socket.on("disconnect", (reason) => {
      metrics.connectionsClosed += 1;
      metrics.lastDisconnectReason = reason || "unknown";
      console.info("[realtime] disconnected", {
        socketId: socket.id,
        connectionType: claims.typ,
        reason: reason || "unknown",
        activeConnections: io.engine.clientsCount,
      });
      clearTimeout(expiryTimer);
      if (revocationTimer) clearInterval(revocationTimer);
      typingLeases.clear((leaseKey) => {
        const [actorType, conversationId] = leaseKey.split(":");
        emitEphemeral(REALTIME_EVENT_TYPES.TYPING_STOPPED, {
          conversationId,
          actorType,
          actorId: claims.sub,
          expiresAt: null,
        });
      });
      ephemeralRateLimiter.clear();
    });
  });

  async function ensureConsumerGroup() {
    try {
      await streamClient.xgroup(
        "CREATE",
        config.streamName,
        config.consumerGroup,
        "0",
        "MKSTREAM"
      );
    } catch (error) {
      if (!String(error.message).includes("BUSYGROUP")) throw error;
    }
  }

  function roomsForEvent(event) {
    const targets = [];
    if (event.visibility !== "PUBLIC" && event.userId) {
      targets.push(rooms.user(event.userId));
    }
    if (event.visibility !== "PUBLIC" && event.workspaceId) {
      targets.push(rooms.workspaceDesk(event.workspaceId));
    }
    if (event.conversationId && event.visibility !== "PUBLIC") {
      targets.push(rooms.conversationOwner(event.conversationId));
    }
    if (event.conversationId && event.visibility !== "OWNER") {
      targets.push(rooms.conversationPublic(event.conversationId));
    }
    return [...new Set(targets)];
  }

  async function consume() {
    let retryMs = 1000;
    while (!stopped) {
      try {
        await ensureConsumerGroup();
        retryMs = 1000;
        while (!stopped) {
          const result = await streamClient.xreadgroup(
            "GROUP", config.consumerGroup, config.consumerName, "COUNT", 50,
            "BLOCK", 5000, "STREAMS", config.streamName, ">"
          );
          if (!result) continue;
          for (const [, messages] of result) {
            for (const [streamId, fields] of messages) {
              const values = Object.fromEntries(
                Array.from({ length: fields.length / 2 }, (_, index) => [fields[index * 2], fields[index * 2 + 1]])
              );
              try {
                let event = parseEvent(values.event);
                if (isOwnerBusinessEventType(event.eventType)) event = parseOwnerBusinessEvent(event);
                for (const room of roomsForEvent(event)) io.to(room).emit(event.eventType, event);
                if (event.eventType === "access.revoked" && event.userId) disconnectUser(event.userId);
                metrics.streamEventsDelivered += 1;
                await streamClient.xack(config.streamName, config.consumerGroup, streamId);
              } catch (error) {
                metrics.streamEventsRejected += 1;
                console.error("[realtime] event rejected", { message: error.message });
                await streamClient.xack(config.streamName, config.consumerGroup, streamId);
              }
            }
          }
        }
      } catch (error) {
        if (stopped) break;
        metrics.redisErrors += 1;
        console.error("[realtime] consumer retrying", { message: error.message, retryMs });
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        retryMs = Math.min(30_000, retryMs * 2);
      }
    }
  }

  const consumer = consume().catch((error) => {
    if (!stopped) {
      console.error("[realtime] consumer fatal", { message: error.message });
    }
  });

  return {
    io,
    config,
    isReady() {
      return pubClient.status === "ready" && streamClient.status === "ready";
    },
    getMetrics() {
      return {
        ...metrics,
        activeConnections: io.engine.clientsCount,
        redisReady: pubClient.status === "ready" && streamClient.status === "ready",
      };
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      io.close();
      await Promise.allSettled([
        consumer,
        pubClient.quit(),
        subClient.quit(),
        streamClient.quit(),
        closeSessionCheckPool(),
      ]);
    },
  };
}
