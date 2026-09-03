/**
 * Human-friendly Knowledge list title for crawled website docs.
 */
export function simpleWebsiteKnowledgeName(profileOrOrigin) {
  if (!profileOrOrigin) return "Website";

  if (typeof profileOrOrigin === "string") {
    return hostnameLabel(profileOrOrigin) || "Website";
  }

  const businessName = String(
    profileOrOrigin.aiSummary?.businessName ||
      profileOrOrigin.businessName ||
      profileOrOrigin.siteName ||
      ""
  )
    .trim()
    .replace(/\s*[|\-–—].*$/, "")
    .slice(0, 48);

  if (businessName && businessName.length >= 2 && !/^https?:/i.test(businessName)) {
    return businessName;
  }

  return hostnameLabel(profileOrOrigin.origin) || "Website";
}

function hostnameLabel(origin) {
  try {
    const host = new URL(origin).hostname.replace(/^www\./i, "");
    return host || null;
  } catch {
    return null;
  }
}
