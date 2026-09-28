import { notFound } from "next/navigation";
import {
  customerDocsNav,
  getCustomerDocBySlug,
  listCustomerDocs,
} from "@/lib/customer-docs";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export function generateStaticParams() {
  return listCustomerDocs()
    .filter((p) => p.slug)
    .map((p) => ({ slug: p.slug.split("/") }));
}

export async function generateMetadata({ params }) {
  const resolved = await params;
  const doc = getCustomerDocBySlug(resolved?.slug || []);
  if (!doc) return { title: "Aide Docs" };
  return {
    title: `${doc.title} · Aide Docs`,
    description: doc.description || undefined,
  };
}

export default async function DocsSlugPage({ params }) {
  const resolved = await params;
  const slugParts = resolved?.slug || [];
  const doc = getCustomerDocBySlug(slugParts);
  if (!doc || !doc.slug) notFound();
  const nav = customerDocsNav();

  return (
    <div className="flex flex-col gap-6">
      <div className="md:hidden">
        <DocsSidebar nav={nav} />
      </div>
      <DocsArticle
        title={doc.title}
        description={doc.description}
        body={doc.body}
      />
    </div>
  );
}
