export const ADMIN_NAV_GROUPS = [
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/admin", label: "Dashboard", exact: true, icon: "dashboard" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/requests", label: "Requests", icon: "requests" },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    items: [
      { href: "/admin/safety", label: "Safety", icon: "safety" },
      { href: "/admin/audit", label: "Audit", icon: "audit" },
    ],
  },
];

export const ADMIN_NAV = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

export function isAdminNavActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
