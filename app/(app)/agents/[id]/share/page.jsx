import { redirect } from "next/navigation";

export default async function AgentShareRedirect({ params }) {
  const { id } = await params;
  redirect(`/agents/${id}/customization`);
}
