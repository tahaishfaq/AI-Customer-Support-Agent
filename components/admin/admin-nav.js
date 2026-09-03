export const ADMIN_NAV_GROUPS = [
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/admin", label: "Dashboard", exact: true, icon: "dashboard" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/requests", label: "Requests", icon: "requests" },
      { href: "/admin/billing", label: "Billing", icon: "billing" },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    items: [
      { href: "/admin/safety", label: "Safety", icon: "safety" },
      { href: "/admin/audit", label: "Audit", icon: "audit" },
      { href: "/admin/billing/requests", label: "Custom plans", icon: "billingRequests" },
    ],
  },
];

export const ADMIN_NAV = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

export function isAdminNavActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
