export const STUDIO_TABS = [
  { id: "overview", segment: "", label: "Overview" },
  { id: "knowledge", segment: "knowledge", label: "Knowledge" },
  { id: "analytics", segment: "analytics", label: "Analytics" },
  { id: "customization", segment: "customization", label: "Customization" },
  { id: "test", segment: "test", label: "Test" },
  { id: "share", segment: "share", label: "Share" },
];

export const STUDIO_CRUMB_LABELS = {
  knowledge: "Knowledge",
  analytics: "Analytics",
  customization: "Customization",
  test: "Test",
  share: "Share",
  edit: "Edit",
};

export function studioTabHref(agentId, segment) {
  return segment ? `/agents/${agentId}/${segment}` : `/agents/${agentId}`;
}
