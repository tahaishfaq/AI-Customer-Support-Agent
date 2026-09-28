import { getCustomerDocBySlug, listCustomerDocs } from "@/lib/customer-docs";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { customerDocsNav } from "@/lib/customer-docs";

export const metadata = {
  title: "Aide Docs",
  description: "Learn how to build AI customer support agents with Aide.",
};

export default function DocsIndexPage() {
  const doc = getCustomerDocBySlug([]);
  const nav = customerDocsNav();
  const pages = listCustomerDocs().filter((p) => p.slug);

  return (
    <div className="flex flex-col gap-8">
          <div className="md:hidden">
        <DocsSidebar nav={nav} />
      </div>
      {doc ? (
        <DocsArticle
          title={doc.title}
          description={doc.description}
          body={doc.body}
        />
      ) : null}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">All topics</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {pages.map((p) => (
            <li key={p.href}>
              <a
                href={p.href}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                {p.title}
              </a>
              {p.description ? (
                <p className="text-xs text-muted-foreground">{p.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
