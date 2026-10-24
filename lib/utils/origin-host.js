/** Hostname with a single leading `www.` removed (case-insensitive). */
export function stripWwwHost(hostname) {
  return String(hostname || "")
    .toLowerCase()
    .replace(/^www\./, "");
}

/**
 * True when two origins are the same site ignoring a single www/apex difference.
 * Same protocol + port; hosts match after stripping one leading www.
 */
export function crawlOriginsCompatible(a, b) {
  try {
    const left = new URL(String(a));
    const right = new URL(String(b));
    if (left.protocol !== right.protocol) return false;
    const leftPort = left.port || (left.protocol === "https:" ? "443" : "80");
    const rightPort = right.port || (right.protocol === "https:" ? "443" : "80");
    if (leftPort !== rightPort) return false;
    return stripWwwHost(left.hostname) === stripWwwHost(right.hostname);
  } catch {
    return false;
  }
}
