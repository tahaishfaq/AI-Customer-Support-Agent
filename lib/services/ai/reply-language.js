/**
 * Reply language from the customer (B5). Pure: decides which language the agent replies in;
 * never changes routing, retrieval, or what the model is allowed to do.
 *
 * Order: explicit request in this message → explicit request earlier in the chat →
 * language of this message → last detected customer language → knowledge language.
 */

/** Words that are Roman Urdu and (practically) never English. Ambiguous ones (main, do, to, par) are left out. */
const ROMAN_URDU_WORDS =
  /\b(hai|hain|hoon|hun|tha|thi|kya|kyun|kyon|kaise|kaisay|kaisa|kab|kahan|kidhar|kitna|kitne|kitni|nahi|nahin|nai|aap|ap|apka|apki|apke|mujhe|mujhay|mera|meri|mere|hamara|humein|tum|tumhara|yeh|ye|woh|wo|ka|ki|ke|ko|se|tak|bhi|aur|lekin|agar|karo|karna|karun|karein|karen|kar|sakta|sakti|sakte|chahiye|chahta|chahti|batao|bataen|bataein|dein|dijiye|madad|shukriya|meherbani|theek|bilkul|jawab|abhi|jaldi|wala|wali|wale|raha|rahi|rahe|gaya|gayi|hua|hui|mein|dhoondo|dhundo|dhoondein|dikhao|dikhaen|dikhayen|dikhaein|bhejo|bhejein|likho|likhein|samjhao|samjhaen|bolo|batain|chahta|chahte|hoga|hogi|milega|milegi|kijiye|karwa|karwao)\b/g;

const LANGUAGE_NAMES = [
  ["roman_urdu", /\broman\s+urdu\b/],
  ["urdu", /\burdu\b/],
  ["english", /\benglish\b/],
];

/**
 * Explicit "reply in X" request in either language ("reply in English", "Roman Urdu mein jawab dein").
 * @returns {"english"|"urdu"|"roman_urdu"|null}
 */
export function detectLanguageRequest(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return null;
  const asksToReply =
    /\b(reply|answer|respond|write|talk|speak|continue)\b[^.?!]{0,30}\bin\b/.test(t) ||
    /\b(mein|me|main)\s+(jawab|baat|batao|bataen|bataein|likho|likhen|reply|answer)\b/.test(t) ||
    /\bin\s+(roman\s+urdu|urdu|english)\s+(please|pls)\b/.test(t);
  if (!asksToReply) return null;
  for (const [language, pattern] of LANGUAGE_NAMES) {
    if (pattern.test(t)) return language;
  }
  return null;
}

/**
 * Language a customer message is written in, or null when it is too short to tell
 * ("ok", "thanks", emoji) so the previous language is kept.
 * @returns {"english"|"urdu"|"roman_urdu"|null}
 */
export function detectMessageLanguage(text) {
  const sample = String(text || "").slice(0, 2000);
  if (!sample.trim()) return null;
  const arabic = (sample.match(/[؀-ۿ]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  if (arabic >= 3 && arabic >= latin) return "urdu";
  const words = sample.toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
  if (words.length < 3) return null;
  const hits = (sample.toLowerCase().match(ROMAN_URDU_WORDS) || []).length;
  if (hits >= 2 && hits / words.length >= 0.2) return "roman_urdu";
  return "english";
}

/**
 * @param {{
 *   message?: string|null,
 *   history?: Array<{ role?: string, content?: string }>|null,
 *   knowledgeLanguage?: string|null,
 * }} input history newest first; the current message may be included (it is skipped by content)
 * @returns {{ language: "english"|"urdu"|"roman_urdu", source: "request"|"customer"|"knowledge" }}
 */
export function chooseReplyLanguage({ message = "", history = [], knowledgeLanguage = "english" } = {}) {
  const current = String(message || "");
  const requested = detectLanguageRequest(current);
  if (requested) return { language: requested, source: "request" };

  const earlierUserMessages = (Array.isArray(history) ? history : [])
    .filter((m) => String(m?.role || "").toUpperCase() === "USER")
    .map((m) => String(m?.content || ""))
    .filter((content) => content.trim() && content.trim() !== current.trim())
    .slice(0, 10);

  for (const content of earlierUserMessages) {
    const earlierRequest = detectLanguageRequest(content);
    if (earlierRequest) return { language: earlierRequest, source: "request" };
  }

  const detected = detectMessageLanguage(current);
  if (detected) return { language: detected, source: "customer" };

  for (const content of earlierUserMessages) {
    const earlier = detectMessageLanguage(content);
    if (earlier) return { language: earlier, source: "customer" };
  }

  const fallback = ["english", "urdu", "roman_urdu"].includes(knowledgeLanguage) ? knowledgeLanguage : "english";
  return { language: fallback, source: "knowledge" };
}
