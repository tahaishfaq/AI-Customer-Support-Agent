import { STUDIO_CRUMB_LABELS } from "@/components/agents/studio-tabs";

export const PRIMARY_NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/agents", label: "Agents" },
];

export const MONITOR_NAV = [
  { href: "/inbox", label: "Human desk" },
  { href: "/analytics", label: "Analytics" },
];

export function isNavActive(pathname, href) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getBreadcrumbs(pathname, { agentName } = {}) {
  const workspace = { href: "/dashboard", label: "Aide" };
  const agentLabel = agentName || "Agent";

  if (!pathname || pathname === "/dashboard") {
    return [workspace, { label: "Home" }];
  }

  if (pathname === "/agents") {
    return [workspace, { label: "Agents" }];
  }
  if (pathname === "/agents/new") {
    return [workspace, { href: "/agents", label: "Agents" }, { label: "New" }];
  }

  const convoDetailMatch = pathname.match(
    /^\/agents\/([^/]+)\/conversations\/([^/]+)$/
  );
  if (convoDetailMatch) {
    return [
      workspace,
      { href: "/agents", label: "Agents" },
      { href: `/agents/${convoDetailMatch[1]}`, label: agentLabel },
      {
        href: `/agents/${convoDetailMatch[1]}/conversations`,
        label: "Conversations",
      },
      { label: "Thread" },
    ];
  }

  const studioMatch = pathname.match(
    /^\/agents\/([^/]+)\/(knowledge|conversations|analytics|customization|test|edit)$/
  );
  if (studioMatch) {
    return [
      workspace,
      { href: "/agents", label: "Agents" },
      { href: `/agents/${studioMatch[1]}`, label: agentLabel },
      { label: STUDIO_CRUMB_LABELS[studioMatch[2]] },
    ];
  }

  const agentMatch = pathname.match(/^\/agents\/([^/]+)$/);
  if (agentMatch) {
    return [workspace, { href: "/agents", label: "Agents" }, { label: agentLabel }];
  }

  if (pathname === "/chat") {
    return [workspace, { label: "Chat" }];
  }

  if (pathname === "/analytics" || pathname.startsWith("/analytics/")) {
    return [workspace, { label: "Analytics" }];
  }

  if (pathname === "/inbox") {
    return [workspace, { label: "Human desk" }];
  }
  if (pathname.startsWith("/inbox/")) {
    return [
      workspace,
      { href: "/inbox", label: "Human desk" },
      { label: "Thread" },
    ];
  }

  return [workspace, { label: "Home" }];
}
