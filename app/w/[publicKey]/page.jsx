import { notFound } from "next/navigation";
import { getPublicAgentByKey, toPublicAgentView } from "@/lib/services/embed.service";
import { PublicWebchat } from "@/components/embed/PublicWebchat";

export const metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

export default async function PublicWidgetPage({ params, searchParams }) {
  const { publicKey } = await params;
  const query = await searchParams;
  const parentOrigin =
    typeof query.parentOrigin === "string" ? query.parentOrigin : "";
  const agent = await getPublicAgentByKey(publicKey, { origin: parentOrigin });
  if (!agent) notFound();

  return (
    <PublicWebchat
      agent={toPublicAgentView(agent)}
      parentOrigin={parentOrigin}
    />
  );
}
