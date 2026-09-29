/** Typed text a customer can send in one message (server schema and chat boxes share this). */
export const CHAT_MESSAGE_MAX_CHARS = 4_000;
/** Whole message including an attachment block (≤ 8,000 extracted chars + link + metadata). */
export const CHAT_MESSAGE_MAX_TOTAL_CHARS = 12_000;
