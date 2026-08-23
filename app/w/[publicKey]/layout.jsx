import { EmbedDocument } from "@/components/embed/EmbedDocument";

export default function PublicWidgetLayout({ children }) {
  return (
    <div data-hapy-embed className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
      <EmbedDocument />
      {children}
    </div>
  );
}
