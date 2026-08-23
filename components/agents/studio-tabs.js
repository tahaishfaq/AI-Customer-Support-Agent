/**
 * Agent studio primary nav — build path first, then insights.
 * Labels match F04-B hierarchy (Conversations stays as inbox, last).
 */
export const STUDIO_TABS = [
  { id: "overview", segment: "", label: "Overview", group: "build" },
  { id: "knowledge", segment: "knowledge", label: "Knowledge", group: "build" },
  { id: "test", segment: "test", label: "Test", group: "build" },
  {
    id: "customization",
    segment: "customization",
    label: "Customization",
    group: "build",
  },
  {
    id: "analytics",
    segment: "analytics",
    label: "Analytics",
    group: "insights",
  },
  {
    id: "conversations",
    segment: "conversations",
    label: "Conversations",
    group: "insights",
  },
];

export const STUDIO_CRUMB_LABELS = {
  knowledge: "Knowledge",
  conversations: "Conversations",
  analytics: "Analytics",
  customization: "Customization",
  test: "Test",
  edit: "Edit",
};

export function studioTabHref(agentId, segment) {
  return segment ? `/agents/${agentId}/${segment}` : `/agents/${agentId}`;
}
