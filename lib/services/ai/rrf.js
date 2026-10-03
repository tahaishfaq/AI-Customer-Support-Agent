/**
 * Level 3 · L1 — reciprocal rank fusion for lexical + vector knowledge hits.
 * Pure module: no I/O. Rank lists are authoritative; scores are never authority.
 */

export const RRF_K = 60;

/**
 * @param {Array<{ id: string, item: any, rank?: number }>} lists - each list already best-first
 * @param {{ k?: number, limit?: number }} [opts]
 * @returns {Array<{ id: string, item: any, rrfScore: number, sources: string[] }>}
 */
export function reciprocalRankFusion(lists, opts = {}) {
  const k = Number.isFinite(opts.k) ? opts.k : RRF_K;
  const limit = Number.isFinite(opts.limit) ? Math.max(1, opts.limit) : 50;
  const byId = new Map();

  for (const list of Array.isArray(lists) ? lists : []) {
    const name = String(list?.name || "list");
    const rows = Array.isArray(list?.rows) ? list.rows : [];
    rows.forEach((row, index) => {
      const id = String(row?.id || "");
      if (!id) return;
      const rank = Number.isFinite(row.rank) ? row.rank : index + 1;
      const add = 1 / (k + rank);
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, {
          id,
          item: row.item ?? row,
          rrfScore: add,
          sources: [name],
        });
        return;
      }
      prev.rrfScore += add;
      if (!prev.sources.includes(name)) prev.sources.push(name);
    });
  }

  return [...byId.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

/** Cosine similarity for unit-length or raw vectors (pure). */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
