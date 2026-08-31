import { EmbedDocument } from "@/components/embed/EmbedDocument";

export default function PublicWidgetLayout({ children }) {
  return (
    <div data-hapy-embed className="contents">
      <EmbedDocument />
      {children}
    </div>
  );
}
