/**
 * Close markdown a partial stream left open so a growing reply renders formatted
 * (no raw `**` flashing, no re-layout when the final message lands). Display only.
 */
export function closeStreamingMarkdown(text) {
  let out = String(text || "");
  const fences = out.match(/^\s*```/gm)?.length || 0;
  if (fences % 2 === 1) return `${out}\n\`\`\``;
  // Inline markers only count outside fenced code.
  const prose = out.replace(/```[\s\S]*?```/g, "");
  const ticks = prose.match(/`/g)?.length || 0;
  if (ticks % 2 === 1) out += "`";
  const bold = prose.match(/\*\*/g)?.length || 0;
  if (bold % 2 === 1) out += "**";
  // A half-typed link "[label](http…" renders as its label until the ")" arrives.
  out = out.replace(/\[([^\]\n]*)\]\([^)\s]*$/, "$1");
  return out;
}
