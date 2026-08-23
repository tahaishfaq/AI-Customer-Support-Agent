const PREFIX = "hapy:embed:";

function historyKey(publicKey) {
  return `${PREFIX}${publicKey}:history`;
}

export function loadEmbedHistory(publicKey, resetMode) {
  const store =
    resetMode === "session" ? window.sessionStorage : window.localStorage;
  try {
    const raw = store.getItem(historyKey(publicKey));
    if (!raw) return { conversations: [], activeId: null };
    const parsed = JSON.parse(raw);
    const maxAge =
      resetMode === "1d"
        ? 86400000
        : resetMode === "7d"
          ? 7 * 86400000
          : null;
    let conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations
      : [];
    if (maxAge) {
      const cutoff = Date.now() - maxAge;
      conversations = conversations.filter(
        (row) => new Date(row.updatedAt || 0).getTime() >= cutoff
      );
    }
    return {
      conversations,
      activeId: parsed.activeId || null,
    };
  } catch {
    return { conversations: [], activeId: null };
  }
}

export function saveEmbedHistory(publicKey, state, resetMode) {
  const store =
    resetMode === "session" ? window.sessionStorage : window.localStorage;
  try {
    store.setItem(
      historyKey(publicKey),
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
  return [conversation, ...rest];
}

/** Keep past chats but drop the active session pointer (fresh chat on page reload). */
export function clearActiveEmbedSession(publicKey, resetMode) {
  const stored = loadEmbedHistory(publicKey, resetMode);
  saveEmbedHistory(
    publicKey,
    { conversations: stored.conversations, activeId: null },
    resetMode
  );
  return stored.conversations;
}
