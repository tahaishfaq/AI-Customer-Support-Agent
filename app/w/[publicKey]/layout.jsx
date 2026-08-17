import { EmbedDocument } from "@/components/embed/EmbedDocument";

export default function PublicWidgetLayout({ children }) {
  return (
    <div data-hapy-embed className="h-full min-h-0 overflow-hidden bg-transparent">
      <EmbedDocument />
      {children}
    </div>
  );
}
