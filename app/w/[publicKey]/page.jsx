import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicAgentByKey, toPublicAgentView } from "@/lib/services/embed.service";
import { PublicWebchat } from "@/components/embed/PublicWebchat";
import { originFromHeaderValues } from "@/lib/utils/request-origin";

export const metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

export default async function PublicWidgetPage({ params, searchParams }) {
  const { publicKey } = await params;
  const query = await searchParams;
  const h = await headers();
  // Access control uses Referer (iframe navigations send the parent URL).
  // Query parentOrigin is only a UI/postMessage hint when it matches Referer.
  const trustedOrigin = originFromHeaderValues({
    referer: h.get("referer"),
  });
  const queryParent =
    typeof query.parentOrigin === "string" ? query.parentOrigin : "";
  let parentOrigin = trustedOrigin;
  if (trustedOrigin && queryParent) {
    try {
      if (new URL(queryParent).origin === trustedOrigin) {
        parentOrigin = trustedOrigin;
      }
    } catch {
      // keep trustedOrigin
    }
  } else if (!trustedOrigin && queryParent) {
    // No Referer (strict RP): allow UI framing hint only; lock checks use "".
    parentOrigin = queryParent;
  }

  const embedMode = typeof query.embed === "string" ? query.embed : "";

  const agent = await getPublicAgentByKey(publicKey, {
    origin: trustedOrigin,
  });
  if (!agent) notFound();

  return (
    <PublicWebchat
      agent={toPublicAgentView(agent)}
      parentOrigin={parentOrigin}
      embedMode={embedMode}
    />
  );
}
