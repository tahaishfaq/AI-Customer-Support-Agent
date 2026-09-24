import { NextResponse } from "next/server";

const ARTICLES = [
  {
    id: "help-escrow",
    title: "How Brandly escrow works",
    snippet:
      "Brand funds the campaign in Stripe escrow before work starts. Funds release to the creator after deliverable approval.",
  },
  {
    id: "help-payout",
    title: "Instant payouts for creators",
    snippet:
      "Complete KYC and add a verified bank account under Billing. Approved campaign payouts typically arrive within 24 hours.",
  },
  {
    id: "help-matching",
    title: "AI matching algorithm",
    snippet:
      "Brandly AI compares niche, audience demographics, engagement, and past performance to suggest high-ROI brand–creator fits.",
  },
  {
    id: "help-dispute",
    title: "Resolving campaign disputes",
    snippet:
      "Open a support ticket with the campaign ID. Moderation reviews the brief, deliverables, and chat within 3–5 business days.",
  },
  {
    id: "help-profile",
    title: "Creator profile setup",
    snippet:
      "Complete your profile and connect YouTube, Instagram, or TikTok via OAuth so brands see verified stats.",
  },
  {
    id: "help-refund",
    title: "Refund policy",
    snippet: "Refunds are available within 14 days of purchase for unused plan fees where applicable.",
  },
];

/**
 * F13-T0 / Brandly demo help search.
 * GET /api/demo/help?q=escrow
 */
export async function GET(request) {
  const q = String(request.nextUrl.searchParams.get("q") || "")
    .trim()
    .toLowerCase();
  // Any keyword matches ("escrow payouts" finds both articles); best matches first.
  const terms = q
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3)
    .map((term) => (term.length > 4 && term.endsWith("s") ? term.slice(0, -1) : term));
  const hits = q
    ? ARTICLES.map((a) => {
        const haystack = `${a.id} ${a.title} ${a.snippet}`.toLowerCase();
        const score = haystack.includes(q) ? terms.length + 1 : terms.filter((term) => haystack.includes(term)).length;
        return { a, score };
      })
        .filter((entry) => entry.score > 0)
        .sort((x, y) => y.score - x.score)
        .map((entry) => entry.a)
    : ARTICLES;
  return NextResponse.json(
    { query: q || null, results: hits.slice(0, 5) },
    { status: 200 }
  );
}
