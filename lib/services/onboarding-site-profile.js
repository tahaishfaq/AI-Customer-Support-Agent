import { chatCompletion } from "@/lib/services/ai/llm.provider";
import {
  crawlPublicOrigin,
  normalizeHttpsOrigin,
} from "@/lib/services/site-crawler";
import { redactPublicText } from "@/lib/services/site-redact";

function homepagePage(pages, origin) {
  return (
    pages.find((page) => {
      try {
        const path = new URL(page.url).pathname;
        return path === "/" || path === "";
      } catch {
        return false;
      }
    }) || pages[0]
  );
}

export function buildBusinessProfileFromPages({ origin, pages }) {
  const home = homepagePage(pages, origin);
  const titles = pages
    .slice(0, 12)
    .map((page) => ({ title: page.title || null, url: page.url }));

  const topics = [];
  for (const page of pages) {
    try {
      const path = new URL(page.url).pathname.toLowerCase();
      if (/pricing|price/.test(path)) topics.push("pricing");
      if (/about/.test(path)) topics.push("about");
      if (/contact/.test(path)) topics.push("contact");
      if (/faq|help|support/.test(path)) topics.push("support");
      if (/shipping|delivery/.test(path)) topics.push("shipping");
      if (/privacy|terms|policy/.test(path)) topics.push("policies");
    } catch {
      // ignore
    }
  }

  return {
    origin,
    siteName: home?.title || null,
    pageCount: pages.length,
    detectedTopics: [...new Set(topics)],
    pages: titles,
    excerpt: redactPublicText(
      pages
        .slice(0, 4)
        .map((page) => page.text.slice(0, 600))
        .join("\n\n")
    ).slice(0, 2400),
    crawledAt: new Date().toISOString(),
  };
}

async function summarizeBusinessProfile(profile) {
  if (!profile.excerpt || profile.excerpt.length < 80) return profile;

  try {
    const reply = await chatCompletion({
      system: [
        "Extract public business facts for a B2B SaaS onboarding record.",
        "Return JSON only with keys: businessName, industry, summary, offerings (string array), supportChannels (string array).",
        "Use only facts from the text. Omit unknown fields.",
        "Never invent pricing or private data.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            origin: profile.origin,
            siteName: profile.siteName,
            topics: profile.detectedTopics,
            excerpt: profile.excerpt,
          }),
        },
      ],
    });

    const match = String(reply.content || "").match(/\{[\s\S]*\}/);
    if (!match) return profile;
    const parsed = JSON.parse(match[0]);
    return {
      ...profile,
      aiSummary: {
        businessName: parsed.businessName || profile.siteName || null,
        industry: parsed.industry || null,
        summary: parsed.summary || null,
        offerings: Array.isArray(parsed.offerings) ? parsed.offerings.slice(0, 8) : [],
        supportChannels: Array.isArray(parsed.supportChannels)
          ? parsed.supportChannels.slice(0, 6)
          : [],
      },
    };
  } catch {
    return profile;
  }
}

export async function crawlWebsiteBusinessProfile(websiteUrl) {
  const normalized = normalizeHttpsOrigin(websiteUrl);
  if (!normalized || normalized.skip) {
    const err = new Error("Enter a valid public https website URL");
    err.status = 400;
    throw err;
  }

  const { origin, pages } = await crawlPublicOrigin(normalized.origin);
  if (!pages.length) {
    const err = new Error("Could not read public pages from that website");
    err.status = 422;
    throw err;
  }

  const profile = buildBusinessProfileFromPages({ origin, pages });
  return summarizeBusinessProfile(profile);
}
