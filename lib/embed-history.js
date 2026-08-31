const PREFIX = "hapy:embed:";

/** Current embed chat stays on refresh; after this it opens as a new chat. */
export const EMBED_ACTIVE_CHAT_TTL_MS = 24 * 60 * 60 * 1000;

function historyKey(publicKey, userSubject = null) {
  const subject =
    typeof userSubject === "string" ? userSubject.trim() : "";
  if (subject) {
    return `${PREFIX}${publicKey}:user:${subject}:history`;
  }
  return `${PREFIX}${publicKey}:history`;
}

export function isEmbedChatFresh(row, now = Date.now()) {
  if (!row) return false;
  const start = new Date(row.startedAt || row.updatedAt || 0).getTime();
  if (!Number.isFinite(start) || start <= 0) return false;
  return now - start < EMBED_ACTIVE_CHAT_TTL_MS;
}

export function loadEmbedHistory(publicKey, resetMode, userSubject = null) {
  const store =
    resetMode === "session" ? window.sessionStorage : window.localStorage;
  try {
    const raw = store.getItem(historyKey(publicKey, userSubject));
    if (!raw) return { conversations: [], activeId: null };
    const parsed = JSON.parse(raw);
    const maxAge =
      resetMode === "1d"
        ? EMBED_ACTIVE_CHAT_TTL_MS
        : resetMode === "7d"
          ? 7 * EMBED_ACTIVE_CHAT_TTL_MS
          : null;
    let conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations
      : [];
    if (maxAge) {
      const cutoff = Date.now() - maxAge;
      conversations = conversations.filter(
        (row) => new Date(row.updatedAt || row.startedAt || 0).getTime() >= cutoff
      );
    }
    const active = conversations.find((row) => row.id === parsed.activeId);
    const activeId = isEmbedChatFresh(active) ? parsed.activeId : null;
    return {
      conversations,
      activeId,
    };
  } catch {
    return { conversations: [], activeId: null };
  }
}

export function saveEmbedHistory(
  publicKey,
  state,
  resetMode,
  userSubject = null
) {
  const store =
    resetMode === "session" ? window.sessionStorage : window.localStorage;
  try {
    store.setItem(
      historyKey(publicKey, userSubject),
      JSON.stringify({
        conversations: (state.conversations || []).slice(0, 30),
        activeId: state.activeId || null,
      })
    );
  } catch {
    // quota
  }
}

export function upsertHistoryConversation(list, conversation) {
  const rest = list.filter((row) => row.id !== conversation.id);
  const existing = list.find((row) => row.id === conversation.id);
  return [
    {
      ...conversation,
      startedAt: existing?.startedAt || conversation.startedAt || conversation.updatedAt,
    },
    ...rest,
  ];
}

/** Copy guest active thread to a signed-in user once (login without losing chat). */
export function migrateGuestHistoryToUser(publicKey, resetMode, userSubject) {
  const subject =
    typeof userSubject === "string" ? userSubject.trim() : "";
  if (!subject) return;
  const guest = loadEmbedHistory(publicKey, resetMode, null);
  if (!guest.activeId) return;
  const user = loadEmbedHistory(publicKey, resetMode, subject);
  if (user.activeId) return;
  const guestRow = guest.conversations.find((row) => row.id === guest.activeId);
  const conversations = upsertHistoryConversation(user.conversations, {
    id: guest.activeId,
    preview: guestRow?.preview || "Conversation",
    updatedAt: guestRow?.updatedAt || new Date().toISOString(),
    startedAt: guestRow?.startedAt || new Date().toISOString(),
  });
  saveEmbedHistory(
    publicKey,
    { conversations, activeId: guest.activeId },
    resetMode,
    subject
  );
}

export function touchActiveConversation(
  publicKey,
  resetMode,
  userSubject,
  conversationId,
  messages
) {
  if (!conversationId) return { conversations: [], activeId: null };
  const stored = loadEmbedHistory(publicKey, resetMode, userSubject);
  const existing = stored.conversations.find((row) => row.id === conversationId);
  const last = [...(messages || [])].reverse().find((m) => m.content);
  const preview = (last?.content || "Conversation")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "Image")
    .slice(0, 120);
  const row = {
    id: conversationId,
    preview,
    updatedAt: new Date().toISOString(),
    startedAt: existing?.startedAt || new Date().toISOString(),
  };
  const conversations = upsertHistoryConversation(stored.conversations, row);
  saveEmbedHistory(
    publicKey,
    { conversations, activeId: conversationId },
    resetMode,
    userSubject
  );
  return { conversations, activeId: conversationId };
}
