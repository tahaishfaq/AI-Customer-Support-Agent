/**
 * Customer-facing Aide docs (Markdown under content/customer-docs).
 * Used by /docs routes — public HTML for crawl + RAG.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "content", "customer-docs");

function parseFrontmatter(raw) {
  const text = String(raw || "");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: text.trim() };
  const data = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (/^\d+$/.test(value)) data[key] = Number(value);
    else data[key] = value;
  }
  return { data, body: match[2].trim() };
}

function slugFromFile(file) {
  return String(file || "")
    .replace(/\.md$/i, "")
    .replace(/^index$/i, "");
}

/**
 * @returns {Array<{ slug: string, href: string, title: string, description: string, order: number, body: string }>}
 */
export function listCustomerDocs() {
  if (!fs.existsSync(ROOT)) return [];
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const pages = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const rawSlug =
      data.slug !== undefined && data.slug !== null
        ? String(data.slug)
        : slugFromFile(file);
    const slug = rawSlug.replace(/^\/+|\/+$/g, "");
    const href = slug ? `/docs/${slug}` : "/docs";
    pages.push({
      slug,
      href,
      title: String(data.title || slug || "Aide Docs"),
      description: String(data.description || ""),
      order: Number.isFinite(data.order) ? data.order : 100,
      body,
    });
  }
  pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return pages;
}

/**
 * @param {string[]} slugParts
 */
export function getCustomerDocBySlug(slugParts) {
  const slug = (Array.isArray(slugParts) ? slugParts : [])
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join("/");
  const pages = listCustomerDocs();
  if (!slug) {
    return pages.find((p) => !p.slug) || pages[0] || null;
  }
  return pages.find((p) => p.slug === slug) || null;
}

export function customerDocsNav() {
  return listCustomerDocs().map((p) => ({
    href: p.href,
    title: p.title,
    order: p.order,
  }));
}
