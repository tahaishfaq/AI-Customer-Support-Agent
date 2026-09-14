import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10000,
});

export async function assertRealtimeSessionActive({ sessionId, tokenId, userId }) {
  if (!sessionId || !tokenId || !userId) return false;
  const result = await pool.query(
    `SELECT rs.id
       FROM "RealtimeSession" rs
       JOIN "User" u ON u.id = rs."userId"
      WHERE rs.id = $1
        AND rs."tokenId" = $2
        AND rs."userId" = $3
        AND rs."revokedAt" IS NULL
        AND rs."expiresAt" > NOW()
        AND u.status = 'ACTIVE'
      LIMIT 1`,
    [sessionId, tokenId, userId]
  );
  return result.rowCount === 1;
}

export async function assertOwnerConversationAccess({ userId, conversationId }) {
  if (!userId || !conversationId) return false;
  const result = await pool.query(
    `SELECT c.id
       FROM "Conversation" c
       JOIN "Agent" a ON a.id = c."agentId"
      WHERE c.id = $1
        AND a."userId" = $2
      LIMIT 1`,
    [conversationId, userId]
  );
  return result.rowCount === 1;
}

export async function assertPublicConversationAccess({
  accessId,
  conversationId,
  agentId,
}) {
  if (!accessId || !conversationId || !agentId) return false;
  const result = await pool.query(
    `SELECT pca.id
       FROM "PublicConversationAccess" pca
       JOIN "Conversation" c ON c.id = pca."conversationId"
       JOIN "Agent" a ON a.id = c."agentId"
      WHERE pca.id = $1
        AND pca."conversationId" = $2
        AND c."agentId" = $3
        AND pca."revokedAt" IS NULL
        AND pca."expiresAt" > NOW()
        AND a.enabled = TRUE
        AND a."embedEnabled" = TRUE
      LIMIT 1`,
    [accessId, conversationId, agentId]
  );
  return result.rowCount === 1;
}

export async function closeSessionCheckPool() {
  await pool.end();
}
