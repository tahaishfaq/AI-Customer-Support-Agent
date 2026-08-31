import { NextResponse } from "next/server";

const ARTICLES = [
  {
    id: "help-refund",
    title: "Refund policy",
    snippet: "Refunds are available within 14 days of purchase.",
  },
  {
    id: "help-shipping",
    title: "Shipping times",
    snippet: "Standard shipping takes 3–5 business days.",
  },
  {
    id: "help-password",
    title: "Reset password",
    snippet: "Use Forgot password on the login page to reset.",
  },
];

/**
 * F13-T0 demo help search.
 * GET /api/demo/help?q=refund
 */
export async function GET(request) {
  const q = String(request.nextUrl.searchParams.get("q") || "")
    .trim()
    .toLowerCase();
  const hits = q
    ? ARTICLES.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.snippet.toLowerCase().includes(q) ||
          a.id.includes(q)
      )
    : ARTICLES;
  return NextResponse.json(
    { query: q || null, results: hits.slice(0, 5) },
    { status: 200 }
  );
}
